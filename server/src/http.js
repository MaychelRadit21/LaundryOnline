export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const ok = (res, data, meta, status = 200) =>
  res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });

export const parseId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new ApiError(400, 'ID tidak valid');
  return id;
};

export function parsePaging(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  return { page, limit, offset: (page - 1) * limit };
}

export const pagingMeta = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

// Validator ringan: setiap aturan mengembalikan pesan error atau undefined.
export function validate(body, rules) {
  const errors = {};
  const clean = {};
  for (const [field, rule] of Object.entries(rules)) {
    let v = body?.[field];
    if (typeof v === 'string') v = v.trim();
    const empty = v === undefined || v === null || v === '';
    if (empty) {
      if (rule.required) errors[field] = `${rule.label} wajib diisi`;
      else clean[field] = rule.default ?? null;
      continue;
    }
    if (rule.type === 'number') {
      v = Number(v);
      if (!Number.isFinite(v)) { errors[field] = `${rule.label} harus berupa angka`; continue; }
      if (rule.int && !Number.isInteger(v)) { errors[field] = `${rule.label} harus bilangan bulat`; continue; }
      if (rule.min !== undefined && v < rule.min) { errors[field] = `${rule.label} minimal ${rule.min}`; continue; }
      if (rule.max !== undefined && v > rule.max) { errors[field] = `${rule.label} maksimal ${rule.max}`; continue; }
    } else if (rule.type === 'boolean') {
      v = v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0;
    } else {
      v = String(v);
      if (rule.min && v.length < rule.min) { errors[field] = `${rule.label} minimal ${rule.min} karakter`; continue; }
      if (rule.max && v.length > rule.max) { errors[field] = `${rule.label} maksimal ${rule.max} karakter`; continue; }
      if (rule.pattern && !rule.pattern.test(v)) { errors[field] = rule.message || `${rule.label} tidak valid`; continue; }
      if (rule.oneOf && !rule.oneOf.includes(v)) { errors[field] = `${rule.label} harus salah satu dari: ${rule.oneOf.join(', ')}`; continue; }
    }
    clean[field] = v;
  }
  if (Object.keys(errors).length) throw new ApiError(422, 'Validasi gagal', errors);
  return clean;
}

export const PHONE = /^(\+62|62|0)8[0-9]{8,12}$/;
