using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using LaundryApi;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var connection = builder.Configuration.GetConnectionString("Laundry")
    ?? throw new InvalidOperationException("Set ConnectionStrings: Laundry.");
var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || Encoding.UTF8.GetByteCount(jwtKey) < 32)
    throw new InvalidOperationException("Set Jwt:Key to at least 32 bytes.");
builder.Services.AddDbContext<LaundryDb>(o => o.UseSqlServer(connection));
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
{
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true, ValidIssuer = "LaundryOnline",
        ValidateAudience = true, ValidAudience = "LaundryOnline",
        ValidateLifetime = true, ClockSkew = TimeSpan.Zero,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
    };
});
builder.Services.AddAuthorization();
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins(builder.Configuration["FrontendOrigin"] ?? "http://localhost:5173")
        .AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<LaundryDb>();
    await db.Database.EnsureCreatedAsync();
    var adminEmail = builder.Configuration["InitialAdmin:Email"]?.Trim().ToLowerInvariant();
    var adminPassword = builder.Configuration["InitialAdmin:Password"];
    if (!await db.Users.AnyAsync(u => u.Role == "Admin") && !string.IsNullOrWhiteSpace(adminEmail)
        && !string.IsNullOrWhiteSpace(adminPassword) && adminPassword.Length >= 8)
    {
        var admin = new User { Name = "Administrator", Email = adminEmail, Role = "Admin" };
        admin.PasswordHash = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>().HashPassword(admin, adminPassword);
        db.Users.Add(admin);
        await db.SaveChangesAsync();
    }
}

app.MapPost("/api/auth/register", async (RegisterRequest input, LaundryDb db, IPasswordHasher<User> hasher) =>
{
    if (!ValidUser(input.Name, input.Email, input.Password, input.Phone)) return Results.BadRequest("Nama, email, dan password (minimal 8 karakter) wajib diisi.");
    var email = input.Email.Trim().ToLowerInvariant();
    if (await db.Users.AnyAsync(u => u.Email == email)) return Results.Conflict("Email sudah terdaftar.");
    var user = new User { Name = input.Name.Trim(), Email = email, Phone = input.Phone?.Trim() ?? "", Role = "Pelanggan" };
    user.PasswordHash = hasher.HashPassword(user, input.Password);
    db.Users.Add(user);
    try { await db.SaveChangesAsync(); } catch (DbUpdateException) { return Results.Conflict("Email sudah terdaftar."); }
    return Results.Created($"/api/customers/{user.Id}", PublicUser(user));
});

app.MapPost("/api/auth/login", async (LoginRequest input, LaundryDb db, IPasswordHasher<User> hasher) =>
{
    var email = input.Email?.Trim().ToLowerInvariant();
    var user = await db.Users.SingleOrDefaultAsync(u => u.Email == email);
    if (user == null || string.IsNullOrEmpty(input.Password) ||
        hasher.VerifyHashedPassword(user, user.PasswordHash, input.Password) == PasswordVerificationResult.Failed)
        return Results.Unauthorized();
    var claims = new[] { new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()), new Claim(ClaimTypes.Role, user.Role) };
    var token = new JwtSecurityToken("LaundryOnline", "LaundryOnline", claims, expires: DateTime.UtcNow.AddHours(8),
        signingCredentials: new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)), SecurityAlgorithms.HmacSha256));
    return Results.Ok(new { token = new JwtSecurityTokenHandler().WriteToken(token), user = PublicUser(user) });
});

var staff = app.MapGroup("/api").RequireAuthorization(p => p.RequireRole("Admin", "Kasir"));
var adminOnly = app.MapGroup("/api").RequireAuthorization(p => p.RequireRole("Admin"));
var authenticated = app.MapGroup("/api").RequireAuthorization();

staff.MapGet("/customers", async (LaundryDb db) =>
    await db.Users.Where(u => u.Role == "Pelanggan").OrderBy(u => u.Name)
        .Select(u => new { u.Id, u.Name, u.Email, u.Phone, u.Role, u.IsMember }).ToListAsync());
staff.MapGet("/customers/{id:int}", async (int id, LaundryDb db) =>
{
    var user = await db.Users.SingleOrDefaultAsync(u => u.Id == id && u.Role == "Pelanggan");
    return user == null ? Results.NotFound() : Results.Ok(PublicUser(user));
});
staff.MapPost("/customers", async (RegisterRequest input, LaundryDb db, IPasswordHasher<User> hasher) =>
{
    if (!ValidUser(input.Name, input.Email, input.Password, input.Phone)) return Results.BadRequest("Data pelanggan tidak valid.");
    var email = input.Email.Trim().ToLowerInvariant();
    if (await db.Users.AnyAsync(u => u.Email == email)) return Results.Conflict("Email sudah terdaftar.");
    var user = new User { Name = input.Name.Trim(), Email = email, Phone = input.Phone?.Trim() ?? "", Role = "Pelanggan" };
    user.PasswordHash = hasher.HashPassword(user, input.Password);
    db.Users.Add(user);
    try { await db.SaveChangesAsync(); } catch (DbUpdateException) { return Results.Conflict("Email sudah terdaftar."); }
    return Results.Created($"/api/customers/{user.Id}", PublicUser(user));
});
staff.MapPut("/customers/{id:int}", async (int id, CustomerUpdate input, LaundryDb db) =>
{
    var user = await db.Users.SingleOrDefaultAsync(u => u.Id == id && u.Role == "Pelanggan");
    if (user == null) return Results.NotFound();
    if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Length > 100 || (input.Phone?.Length ?? 0) > 30) return Results.BadRequest("Data pelanggan tidak valid.");
    user.Name = input.Name.Trim(); user.Phone = input.Phone?.Trim() ?? ""; user.IsMember = input.IsMember;
    await db.SaveChangesAsync();
    return Results.Ok(PublicUser(user));
});
staff.MapDelete("/customers/{id:int}", async (int id, LaundryDb db) =>
{
    var user = await db.Users.SingleOrDefaultAsync(u => u.Id == id && u.Role == "Pelanggan");
    if (user == null) return Results.NotFound();
    if (await db.Orders.AnyAsync(o => o.CustomerId == id)) return Results.Conflict("Pelanggan memiliki riwayat transaksi.");
    db.Users.Remove(user); await db.SaveChangesAsync(); return Results.NoContent();
});
adminOnly.MapPost("/staff", async (RegisterRequest input, LaundryDb db, IPasswordHasher<User> hasher) =>
{
    if (!ValidUser(input.Name, input.Email, input.Password, input.Phone)) return Results.BadRequest("Data kasir tidak valid.");
    var email = input.Email.Trim().ToLowerInvariant();
    if (await db.Users.AnyAsync(u => u.Email == email)) return Results.Conflict("Email sudah terdaftar.");
    var user = new User { Name = input.Name.Trim(), Email = email, Phone = input.Phone?.Trim() ?? "", Role = "Kasir" };
    user.PasswordHash = hasher.HashPassword(user, input.Password);
    db.Users.Add(user);
    try { await db.SaveChangesAsync(); } catch (DbUpdateException) { return Results.Conflict("Email sudah terdaftar."); }
    return Results.Created($"/api/staff/{user.Id}", PublicUser(user));
});

authenticated.MapGet("/services", async (LaundryDb db) => await db.Services.OrderBy(s => s.Name).ToListAsync());
authenticated.MapGet("/services/{id:int}", async (int id, LaundryDb db) =>
{
    var service = await db.Services.FindAsync(id);
    return service == null ? Results.NotFound() : Results.Ok(service);
});
staff.MapPost("/services", async (ServiceInput input, LaundryDb db) =>
{
    if (!ValidService(input)) return Results.BadRequest("Nama dan harga layanan tidak valid.");
    var service = new LaundryService { Name = input.Name.Trim(), PricePerKg = input.PricePerKg };
    db.Services.Add(service); await db.SaveChangesAsync(); return Results.Created($"/api/services/{service.Id}", service);
});
staff.MapPut("/services/{id:int}", async (int id, ServiceInput input, LaundryDb db) =>
{
    var service = await db.Services.FindAsync(id);
    if (service == null) return Results.NotFound();
    if (!ValidService(input)) return Results.BadRequest("Nama dan harga layanan tidak valid.");
    service.Name = input.Name.Trim(); service.PricePerKg = input.PricePerKg;
    await db.SaveChangesAsync(); return Results.Ok(service);
});
staff.MapDelete("/services/{id:int}", async (int id, LaundryDb db) =>
{
    var service = await db.Services.FindAsync(id);
    if (service == null) return Results.NotFound();
    if (await db.Orders.AnyAsync(o => o.ServiceId == id)) return Results.Conflict("Layanan memiliki riwayat transaksi.");
    db.Services.Remove(service); await db.SaveChangesAsync(); return Results.NoContent();
});

authenticated.MapGet("/orders", async (ClaimsPrincipal principal, LaundryDb db) =>
{
    var query = db.Orders.Include(o => o.Customer).Include(o => o.Service).Include(o => o.Payment).AsQueryable();
    if (principal.IsInRole("Pelanggan")) { var id = UserId(principal); query = query.Where(o => o.CustomerId == id); }
    var orders = await query.OrderByDescending(o => o.CreatedAt).ToListAsync();
    return orders.Select(OrderView);
});
authenticated.MapGet("/orders/{id:int}", async (int id, ClaimsPrincipal principal, LaundryDb db) =>
{
    var order = await db.Orders.Include(o => o.Customer).Include(o => o.Service).Include(o => o.Payment)
        .SingleOrDefaultAsync(o => o.Id == id);
    if (order == null || (principal.IsInRole("Pelanggan") && order.CustomerId != UserId(principal))) return Results.NotFound();
    return Results.Ok(OrderView(order));
});
authenticated.MapGet("/membership", async (ClaimsPrincipal principal, LaundryDb db) =>
{
    var user = await db.Users.FindAsync(UserId(principal));
    if (user == null) return Results.NotFound();
    var now = DateTime.UtcNow;
    var start = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
    var used = await db.Orders.Where(o => o.CustomerId == user.Id && o.UsesMembership && o.CreatedAt >= start && o.CreatedAt < start.AddMonths(1)).SumAsync(o => (decimal?)o.WeightKg) ?? 0;
    return Results.Ok(new { user.IsMember, quotaKg = 300, usedKg = used, remainingKg = Math.Max(0, 300 - used), monthUtc = start.ToString("yyyy-MM") });
});
authenticated.MapPost("/orders", async (OrderInput input, ClaimsPrincipal principal, LaundryDb db) =>
{
    if (input.WeightKg <= 0 || input.WeightKg > 10000 || decimal.Round(input.WeightKg, 2) != input.WeightKg)
        return Results.BadRequest("Berat harus lebih dari 0 dan maksimal 10000 kg (2 desimal).");
    var customerId = principal.IsInRole("Pelanggan") ? UserId(principal) : input.CustomerId;
    await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
    var customer = await db.Users.SingleOrDefaultAsync(u => u.Id == customerId && u.Role == "Pelanggan");
    var service = await db.Services.FindAsync(input.ServiceId);
    if (customer == null || service == null) return Results.BadRequest("Pelanggan atau layanan tidak ditemukan.");
    if (input.UseMembership)
    {
        if (!customer.IsMember) return Results.BadRequest("Pelanggan bukan anggota.");
        var now = DateTime.UtcNow;
        var start = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var used = await db.Orders.Where(o => o.CustomerId == customerId && o.UsesMembership && o.CreatedAt >= start && o.CreatedAt < start.AddMonths(1)).SumAsync(o => (decimal?)o.WeightKg) ?? 0;
        if (used + input.WeightKg > 300) return Results.BadRequest("Kuota membership bulanan tidak mencukupi.");
    }
    var order = new Order { CustomerId = customerId, ServiceId = service.Id, ServiceName = service.Name,
        PricePerKg = service.PricePerKg, WeightKg = input.WeightKg, UsesMembership = input.UseMembership,
        Total = input.UseMembership ? 0 : decimal.Round(input.WeightKg * service.PricePerKg, 2),
        CreatedAt = DateTime.UtcNow, Status = "Diterima" };
    db.Orders.Add(order); await db.SaveChangesAsync(); await tx.CommitAsync();
    return Results.Created($"/api/orders/{order.Id}", new { order.Id });
});
staff.MapPut("/orders/{id:int}/status", async (int id, StatusInput input, LaundryDb db) =>
{
    var order = await db.Orders.FindAsync(id);
    if (order == null) return Results.NotFound();
    string[] statuses = ["Diterima", "Dicuci", "Dikeringkan", "Disetrika", "Siap Diambil", "Selesai"];
    if (!statuses.Contains(input.Status)) return Results.BadRequest("Status tidak valid.");
    order.Status = input.Status; await db.SaveChangesAsync(); return Results.Ok(new { order.Id, order.Status });
});
staff.MapPost("/orders/{id:int}/payment", async (int id, PaymentInput input, LaundryDb db) =>
{
    var order = await db.Orders.Include(o => o.Payment).SingleOrDefaultAsync(o => o.Id == id);
    if (order == null) return Results.NotFound();
    if (order.Payment != null) return Results.Conflict("Pesanan sudah dibayar.");
    if (input.Method is not ("Tunai" or "Transfer")) return Results.BadRequest("Metode pembayaran tidak valid.");
    db.Payments.Add(new Payment { OrderId = id, Amount = order.Total, Method = input.Method, PaidAt = DateTime.UtcNow });
    try { await db.SaveChangesAsync(); } catch (DbUpdateException) { return Results.Conflict("Pesanan sudah dibayar."); }
    return Results.Ok(new { order.Id, amount = order.Total, input.Method });
});
staff.MapGet("/reports", async (DateTime? from, DateTime? to, LaundryDb db) =>
{
    if (from.HasValue && to.HasValue && from.Value.Date > to.Value.Date) return Results.BadRequest("Rentang tanggal tidak valid.");
    var query = db.Payments.Include(p => p.Order).ThenInclude(o => o.Customer).AsQueryable();
    if (from.HasValue) query = query.Where(p => p.PaidAt >= from.Value.Date);
    if (to.HasValue && to.Value.Date < DateTime.MaxValue.Date) query = query.Where(p => p.PaidAt < to.Value.Date.AddDays(1));
    var payments = await query.OrderByDescending(p => p.PaidAt).ToListAsync();
    return Results.Ok(new { total = payments.Sum(p => p.Amount), count = payments.Count,
        transactions = payments.Select(p => new { p.OrderId, customer = p.Order.Customer.Name, p.Amount, p.Method, p.PaidAt }) });
});

app.Run();

static bool ValidUser(string? name, string? email, string? password, string? phone) =>
    !string.IsNullOrWhiteSpace(name) && name.Length <= 100 && !string.IsNullOrWhiteSpace(email)
    && email.Length <= 200 && System.Net.Mail.MailAddress.TryCreate(email, out _) && !string.IsNullOrEmpty(password)
    && password.Length is >= 8 and <= 200 && (phone?.Length ?? 0) <= 30;
static bool ValidService(ServiceInput input) => !string.IsNullOrWhiteSpace(input.Name) && input.Name.Length <= 100
    && input.PricePerKg >= 0 && input.PricePerKg <= 100000000 && decimal.Round(input.PricePerKg, 2) == input.PricePerKg;
static int UserId(ClaimsPrincipal p) => int.Parse(p.FindFirstValue(ClaimTypes.NameIdentifier)!);
static object PublicUser(User u) => new { u.Id, u.Name, u.Email, u.Phone, u.Role, u.IsMember };
static object OrderView(Order o) => new { o.Id, o.CustomerId, customer = o.Customer.Name, o.ServiceId, service = o.ServiceName,
    o.PricePerKg, o.WeightKg, o.UsesMembership, o.Total, o.Status, o.CreatedAt,
    payment = o.Payment == null ? null : new { o.Payment.Amount, o.Payment.Method, o.Payment.PaidAt } };
