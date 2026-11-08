using Microsoft.EntityFrameworkCore;

namespace LaundryApi;

public class LaundryDb(DbContextOptions<LaundryDb> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<LaundryService> Services => Set<LaundryService>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<Payment> Payments => Set<Payment>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<User>().HasIndex(u => u.Email).IsUnique();
        model.Entity<Order>().HasOne(o => o.Customer).WithMany().HasForeignKey(o => o.CustomerId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<Order>().HasOne(o => o.Service).WithMany().HasForeignKey(o => o.ServiceId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<Payment>().HasOne(p => p.Order).WithOne(o => o.Payment).HasForeignKey<Payment>(p => p.OrderId);
        model.Entity<Order>().HasIndex(o => new { o.CustomerId, o.CreatedAt });
        foreach (var entity in model.Model.GetEntityTypes())
            foreach (var property in entity.GetProperties().Where(p => p.ClrType == typeof(decimal)))
                property.SetPrecision(18);
        foreach (var entity in model.Model.GetEntityTypes())
            foreach (var property in entity.GetProperties().Where(p => p.ClrType == typeof(decimal)))
                property.SetScale(2);
    }
}

public class User
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Phone { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Role { get; set; } = "Pelanggan";
    public bool IsMember { get; set; }
}
public class LaundryService
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public decimal PricePerKg { get; set; }
}
public class Order
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public User Customer { get; set; } = null!;
    public int ServiceId { get; set; }
    public LaundryService Service { get; set; } = null!;
    public string ServiceName { get; set; } = "";
    public decimal PricePerKg { get; set; }
    public decimal WeightKg { get; set; }
    public bool UsesMembership { get; set; }
    public decimal Total { get; set; }
    public string Status { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public Payment? Payment { get; set; }
}
public class Payment
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;
    public decimal Amount { get; set; }
    public string Method { get; set; } = "";
    public DateTime PaidAt { get; set; }
}

public record RegisterRequest(string Name, string Email, string Password, string? Phone);
public record LoginRequest(string Email, string Password);
public record CustomerUpdate(string Name, string? Phone, bool IsMember);
public record ServiceInput(string Name, decimal PricePerKg);
public record OrderInput(int CustomerId, int ServiceId, decimal WeightKg, bool UseMembership);
public record StatusInput(string Status);
public record PaymentInput(string Method);
