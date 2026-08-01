/**
 * ================================================================
 * Rental Unit Service — Unit Management & Availability
 * ================================================================
 * Ported from: api_rental_request.php (unit CRUD sections)
 * Manages rental_units table: CRUD, availability check, pricing.
 * ================================================================
 */

/**
 * Check if a unit is available for a given date range.
 * 
 * @param {import('@prisma/client').PrismaClient} db
 */
export const checkAvailability = async (db, unitId, startDate, endDate, excludeRentalId = null) => {
  const activeCount = await db.activeRental.count({
    where: {
      unit_id: unitId,
      status: { in: ['active', 'overdue'] },
      NOT: [
        { end_date: { lt: new Date(startDate) } },
        { start_date: { gt: new Date(endDate) } }
      ],
      ...(excludeRentalId ? { id: { not: excludeRentalId } } : {})
    }
  });
  return activeCount === 0;
};

/**
 * Calculate rental price based on duration tiers.
 */
export const calculatePrice = async (db, unitId, durationDays) => {
  const unit = await db.rentalUnit.findUnique({
    where: { id: unitId },
    select: { price_per_day: true, price_per_week: true, price_per_month: true }
  });
  
  if (!unit) return 0;
  
  const d = Number(unit.price_per_day || 0);
  const w = Number(unit.price_per_week || 0);
  const m = Number(unit.price_per_month || 0);

  if (durationDays >= 30 && m > 0) { return Math.floor(durationDays/30)*m + (durationDays%30)*d; }
  if (durationDays >= 7 && w > 0) { return Math.floor(durationDays/7)*w + (durationDays%7)*d; }
  return durationDays * d;
};

/** Fetch all units with current renter info. */
export const fetchAllUnits = async (db) => {
  console.log('[RentalUnit] Fetching all units');
  return await db.$queryRaw`
    SELECT ru.*, ar.phone AS renter_phone, ar.name AS renter_name, 
           ar.start_date AS rental_start, ar.end_date AS rental_end,
           DATEDIFF(ar.end_date, CURDATE()) AS days_remaining 
    FROM rental_units ru 
    LEFT JOIN active_rentals ar ON ru.id = ar.unit_id AND ar.status IN ('active','overdue') 
    ORDER BY ru.status, ru.unit_name
  `;
};

/** Fetch available units, optionally filtered by date range and type. */
export const fetchAvailableUnits = async (db, { startDate, endDate, unitType } = {}) => {
  console.log('[RentalUnit] Fetching available units');
  
  const units = await db.rentalUnit.findMany({
    where: {
      status: 'available',
      ...(unitType ? { unit_type: unitType } : {})
    },
    orderBy: { unit_name: 'asc' }
  });

  if (startDate && endDate) {
    const filtered = [];
    for (const u of units) { 
      if (await checkAvailability(db, u.id, startDate, endDate)) filtered.push(u); 
    }
    return filtered;
  }
  return units;
};

/** Fetch active rentals. */
export const fetchActiveRentals = async (db) => {
  return await db.$queryRaw`
    SELECT ar.*, ru.image_url, ru.color AS unit_color,
           DATEDIFF(ar.end_date, CURDATE()) AS days_remaining,
           DATEDIFF(CURDATE(), ar.start_date) AS days_elapsed 
    FROM active_rentals ar 
    LEFT JOIN rental_units ru ON ar.unit_id = ru.id 
    WHERE ar.status IN ('active','overdue') 
    ORDER BY ar.end_date ASC
  `;
};

/** Add a new rental unit. */
export const addUnit = async (db, data) => {
  console.log(`[RentalUnit] Adding unit: ${data.unit_name}`);
  await db.rentalUnit.create({
    data: {
      unit_name: data.unit_name,
      unit_type: data.unit_type || 'mobil',
      plate_number: data.plate_number || null,
      description: data.description || null,
      price_per_day: data.price_per_day || 0,
      price_per_week: data.price_per_week || 0,
      price_per_month: data.price_per_month || 0,
      color: data.color || null,
      year: data.year ? parseInt(data.year) : null,
      specs: data.specs || null,
      image_url: data.image_url || null
    }
  });
  return { message: 'Unit berhasil ditambahkan' };
};

/** Update unit details. */
export const updateUnit = async (db, unitId, data) => {
  console.log(`[RentalUnit] Updating unit #${unitId}`);
  if (!unitId) throw new Error('Unit ID wajib');
  await db.rentalUnit.update({
    where: { id: unitId },
    data: {
      unit_name: data.unit_name,
      unit_type: data.unit_type || 'mobil',
      plate_number: data.plate_number || null,
      description: data.description || null,
      price_per_day: data.price_per_day || 0,
      price_per_week: data.price_per_week || 0,
      price_per_month: data.price_per_month || 0,
      color: data.color || null,
      year: data.year ? parseInt(data.year) : null,
      specs: data.specs || null,
      image_url: data.image_url || null,
      updated_at: new Date()
    }
  });
  return { message: 'Unit berhasil diupdate' };
};

/** Change unit status. */
export const updateUnitStatus = async (db, unitId, newStatus) => {
  const allowed = ['available','maintenance','retired'];
  if (!unitId || !allowed.includes(newStatus)) throw new Error('Data tidak valid');
  await db.rentalUnit.update({
    where: { id: unitId },
    data: { status: newStatus, current_renter_phone: null, updated_at: new Date() }
  });
  return { message: 'Status unit diupdate' };
};

/** Delete a unit. */
export const deleteUnit = async (db, unitId) => {
  if (!unitId) throw new Error('Unit ID wajib');
  const activeCount = await db.activeRental.count({
    where: { unit_id: unitId, status: { in: ['active','overdue'] } }
  });
  if (activeCount > 0) throw new Error('Unit masih memiliki rental aktif');
  await db.rentalUnit.delete({ where: { id: unitId } });
  return { message: 'Unit dihapus' };
};

/** Return a unit (end rental). */
export const returnUnit = async (db, rentalId, condition = '') => {
  console.log(`[RentalUnit] Returning rental #${rentalId}`);
  if (!rentalId) throw new Error('Rental ID wajib');
  const rental = await db.activeRental.findFirst({
    where: { id: rentalId, status: { in: ['active','overdue'] } }
  });
  if (!rental) throw new Error('Rental aktif tidak ditemukan');
  
  await db.activeRental.update({
    where: { id: rentalId },
    data: { status: 'returned', return_date: new Date(), return_condition: condition, updated_at: new Date() }
  });
  
  if (rental.unit_id) {
    await db.rentalUnit.update({
      where: { id: rental.unit_id },
      data: { status: 'available', current_renter_phone: null, updated_at: new Date() }
    });
  }
  return { message: 'Unit berhasil dikembalikan' };
};

/** Rental dashboard stats. */
export const fetchStats = async (db) => {
  const total_units = await db.rentalUnit.count({ where: { status: { not: 'retired' } } });
  const available_units = await db.rentalUnit.count({ where: { status: 'available' } });
  const rented_units = await db.rentalUnit.count({ where: { status: 'rented' } });
  const maintenance = await db.rentalUnit.count({ where: { status: 'maintenance' } });
  const pending_requests = await db.rentalRequest.count({ where: { status: 'pending' } });
  const active_rentals = await db.activeRental.count({ where: { status: 'active' } });
  const overdue_rentals = await db.activeRental.count({ where: { status: 'overdue' } });
  
  const ending_soon_query = await db.$queryRaw`
    SELECT COUNT(*) as cnt FROM active_rentals 
    WHERE status='active' AND DATEDIFF(end_date,CURDATE()) BETWEEN 0 AND 3
  `;
  
  return {
    total_units, available_units, rented_units, maintenance,
    pending_requests, active_rentals, overdue_rentals,
    ending_soon: Number(ending_soon_query[0]?.cnt || 0)
  };
};

export default { checkAvailability, calculatePrice, fetchAllUnits, fetchAvailableUnits, fetchActiveRentals, addUnit, updateUnit, updateUnitStatus, deleteUnit, returnUnit, fetchStats };
