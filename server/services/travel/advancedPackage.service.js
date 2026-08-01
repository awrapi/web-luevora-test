import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { upsertDocument, deleteDocument } from '../ai_agent/vector.service.js';

export const advancedPackageService = {

  // ============================================================
  // GET ALL packages by type (private, group, others)
  // ============================================================
  getAll: async (tenantId, packageType) => {
    return prisma.advancedTravelPackage.findMany({
      where: { tenant_id: tenantId, package_type: packageType },
      include: {
        sub_items: { orderBy: { sort_order: 'asc' } },
        availability_rules: true,
        slot_overrides: true,
        price_overrides: true,
        addons: { where: { status: 'active' }, orderBy: { sort_order: 'asc' } },
      },
      orderBy: { created_at: 'desc' },
    });
  },

  // ============================================================
  // GET SINGLE package with all relations
  // ============================================================
  getById: async (tenantId, packageId) => {
    const pkg = await prisma.advancedTravelPackage.findFirst({
      where: { id: parseInt(packageId), tenant_id: tenantId },
      include: {
        media_files: { orderBy: { created_at: 'asc' } },
        sub_items: {
          orderBy: { sort_order: 'asc' },
          include: { files: { orderBy: { created_at: 'asc' } } }
        },
        availability_rules: true,
        slot_overrides: true,
        price_overrides: true,
        addons: { where: { status: 'active' }, orderBy: { sort_order: 'asc' }, include: { files: { orderBy: { created_at: 'asc' } } } },
      },
    });

    if (pkg) {
      if (pkg.media_files && pkg.media_files.length > 0) {
        pkg.contexts = [{ id: pkg.id, context_label: "Media Pendukung", ai_summary: pkg.context_description, files: pkg.media_files }];
      } else {
        pkg.contexts = [];
      }
      if (pkg.sub_items) {
        pkg.sub_items.forEach(si => {
          si.contexts = si.files && si.files.length > 0 
            ? [{ id: si.id, context_label: "Media Pendukung", ai_summary: si.context_description, files: si.files }] 
            : [];
        });
      }
      if (pkg.addons) {
        pkg.addons.forEach(addon => {
          addon.contexts = addon.files && addon.files.length > 0 
            ? [{ id: addon.id, context_label: "Media Pendukung", ai_summary: addon.context_description, files: addon.files }] 
            : [];
        });
      }
    }
    return pkg;
  },

  // ============================================================
  // CREATE package with all nested data in a transaction
  // ============================================================
  create: async (tenantId, data) => {
    const fullPkg = await prisma.$transaction(async (tx) => {
      // 1. Create main package
      const pkg = await tx.advancedTravelPackage.create({
        data: {
          tenant_id: tenantId,
          package_type: data.package_type || 'private',
          title: data.title,
          description: data.description || null,
          context_description: data.context_description || null,
          price: data.has_sub_items ? 0 : (parseFloat(data.price) || 0),
          has_sub_items: data.has_sub_items ? 1 : 0,
          custom_prices: data.has_custom_prices ? data.custom_prices : null,
          include_travel_cost: data.include_travel_cost ? 1 : 0,
          travel_cost_context: data.travel_cost_context || null,
          validity_type: data.validity_type || 'always_on',
          expiry_date: data.expiry_date ? new Date(data.expiry_date) : null,
          availability_type: data.availability_type || 'always',
          slot_mode: data.slot_mode || 'always_ready',
          slot_daily: data.slot_daily ? parseInt(data.slot_daily) : null,
          slot_weekly: data.slot_weekly ? parseInt(data.slot_weekly) : null,
          slot_monthly: data.slot_monthly ? parseInt(data.slot_monthly) : null,
          slot_yearly: data.slot_yearly ? parseInt(data.slot_yearly) : null,
          slot_total: data.slot_total ? parseInt(data.slot_total) : null,
          slot_require_admin: data.slot_require_admin ? 1 : 0,
          schedule_enabled: data.schedule_enabled !== undefined ? (data.schedule_enabled ? 1 : 0) : 1,
          departure_description: data.departure_description || null,
          status: 'active',
          transaction_mode: data.transaction_mode || 'auto',
          sub_items: {
            create: (data.sub_items || []).map((si, idx) => ({
              tenant_id: tenantId,
              title: si.title,
              description: si.description || null,
              price: parseFloat(si.price) || 0,
              custom_prices: si.has_custom_prices ? si.custom_prices : null,
              include_travel_cost: si.include_travel_cost ? 1 : 0,
              travel_cost_context: si.travel_cost_context || null,
              sort_order: idx,
              slot_mode: si.slot_mode || 'inherit',
              slot_daily: si.slot_daily ? parseInt(si.slot_daily) : null,
              slot_total: si.slot_total ? parseInt(si.slot_total) : null,
              status: 'active',
            })),
          },
          addons: {
            create: (data.addons || []).map((addon, idx) => ({
              tenant_id: tenantId,
              title: addon.title,
              description: addon.description || null,
              price: addon.price ? parseFloat(addon.price) : 0,
              is_free: addon.is_free ? 1 : 0,
              sort_order: addon.sort_order !== undefined ? addon.sort_order : idx,
              status: addon.status || 'active',
            })),
          },
        },
        include: {
          sub_items: true
        }
      });

      // 3. Create availability rules if any
      let allRules = [];
      if (Array.isArray(data.availability_rules) && data.availability_rules.length > 0) {
        allRules.push(...data.availability_rules.map((rule) => ({
          tenant_id: tenantId,
          package_id: pkg.id,
          sub_item_id: null,
          rule_type: rule.rule_type,
          rule_value: rule.rule_value,
          is_unavailable: rule.is_unavailable !== undefined ? (rule.is_unavailable ? 1 : 0) : 1,
        })));
      }

      if (pkg.sub_items && data.sub_items && data.sub_items.length > 0) {
        pkg.sub_items.forEach((createdSi, idx) => {
          const siData = data.sub_items[idx];
          if (siData && Array.isArray(siData.availability_rules) && siData.availability_rules.length > 0) {
            allRules.push(...siData.availability_rules.map((rule) => ({
              tenant_id: tenantId,
              package_id: pkg.id,
              sub_item_id: createdSi.id,
              rule_type: rule.rule_type,
              rule_value: rule.rule_value,
              is_unavailable: rule.is_unavailable !== undefined ? (rule.is_unavailable ? 1 : 0) : 1,
            })));
          }
        });
      }

      if (allRules.length > 0) {
        await tx.packageAvailabilityRule.createMany({ data: allRules });
      }

      // 4. Create slot overrides if any
      if (Array.isArray(data.slot_overrides) && data.slot_overrides.length > 0) {
        await tx.packageSlotOverride.createMany({
          data: data.slot_overrides.map((so) => ({
            tenant_id: tenantId,
            package_id: pkg.id,
            override_date: new Date(so.override_date),
            slot_limit: parseInt(so.slot_limit),
          })),
        });
      }

      // 5. Create price overrides if any
      if (Array.isArray(data.price_overrides) && data.price_overrides.length > 0) {
        await tx.packagePriceOverride.createMany({
          data: data.price_overrides.map((po) => ({
            tenant_id: tenantId,
            package_id: pkg.id,
            sub_item_id: po.sub_item_id ? parseInt(po.sub_item_id) : null,
            override_date: new Date(po.override_date),
            override_price: parseFloat(po.override_price),
            context: po.context || null,
          })),
        });
      }

      // Return complete package
      return advancedPackageService.getById(tenantId, pkg.id);
    });

    // Trigger Vector Sync
    const getTravelText = (item) => item.include_travel_cost ? ' (TERMASUK TIKET PP / PERJALANAN' + (item.travel_cost_context ? ' - ' + item.travel_cost_context : '') + ')' : (item.travel_cost_context ? ' (Catatan Transport: ' + item.travel_cost_context + ')' : '');
    const getCustomPricesText = (item) => {
      if (!item.custom_prices || !Array.isArray(item.custom_prices)) return '';
      return ' Harga Khusus: ' + item.custom_prices.map(cp => cp.label + ' Rp ' + cp.price + (cp.include_travel_cost ? ' (TERMASUK TIKET PP)' : '')).join(', ');
    };
    let subItemsText = (fullPkg.sub_items || []).map(s => `- ${s.title}: Rp ${s.price}${getTravelText(s)}${getCustomPricesText(s)}${s.description ? ` — ${s.description}` : ''}`).join('\n');
    let addonsText = (fullPkg.addons || []).map(a => `- ${a.title}: Rp ${a.price}${a.description ? ` — ${a.description}` : ''}`).join('\n');
    const textRepresentation = `Paket Advanced: ${fullPkg.title}\nTipe: ${fullPkg.package_type}\nDeskripsi: ${fullPkg.description}\nKonteks AI: ${fullPkg.context_description || ''}\nInclude Perjalanan/Tiket PP: ${fullPkg.include_travel_cost ? 'YA' : 'TIDAK'}\nCatatan Transport: ${fullPkg.travel_cost_context || '-'}\nHarga Utama Khusus:${getCustomPricesText(fullPkg)}\nSub-Paket/Varian:\n${subItemsText}\nAdd-ons:\n${addonsText}`;
    upsertDocument(tenantId, 'AdvancedTravelPackage', fullPkg.id, textRepresentation).catch(err => console.error('Vector Upsert Error:', err.message));

    return fullPkg;
  },

  // ============================================================
  // UPDATE package
  // ============================================================
  update: async (tenantId, packageId, data) => {
    const id = parseInt(packageId);

    const fullPkg = await prisma.$transaction(async (tx) => {
      // 1. Update main package
      const updateData = { updated_at: new Date() };
      const fields = [
        'title', 'description', 'package_type', 'validity_type',
        'availability_type', 'slot_mode', 'status', 'departure_description', 'transaction_mode'
      ];
      fields.forEach(f => { if (data[f] !== undefined) updateData[f] = data[f]; });
      if (data.price !== undefined) updateData.price = parseFloat(data.price);
      if (data.has_sub_items !== undefined) updateData.has_sub_items = data.has_sub_items ? 1 : 0;
      if (data.expiry_date !== undefined) updateData.expiry_date = data.expiry_date ? new Date(data.expiry_date) : null;
      if (data.slot_daily !== undefined) updateData.slot_daily = data.slot_daily ? parseInt(data.slot_daily) : null;
      if (data.slot_weekly !== undefined) updateData.slot_weekly = data.slot_weekly ? parseInt(data.slot_weekly) : null;
      if (data.slot_monthly !== undefined) updateData.slot_monthly = data.slot_monthly ? parseInt(data.slot_monthly) : null;
      if (data.slot_yearly !== undefined) updateData.slot_yearly = data.slot_yearly ? parseInt(data.slot_yearly) : null;
      if (data.slot_total !== undefined) updateData.slot_total = data.slot_total ? parseInt(data.slot_total) : null;
      if (data.schedule_enabled !== undefined) updateData.schedule_enabled = data.schedule_enabled ? 1 : 0;
      if (data.slot_require_admin !== undefined) updateData.slot_require_admin = data.slot_require_admin ? 1 : 0;
      if (data.has_custom_prices !== undefined) updateData.custom_prices = data.has_custom_prices ? data.custom_prices : null;
      if (data.include_travel_cost !== undefined) updateData.include_travel_cost = data.include_travel_cost ? 1 : 0;
      if (data.travel_cost_context !== undefined) updateData.travel_cost_context = data.travel_cost_context;
      if (data.context_description !== undefined) updateData.context_description = data.context_description;

      const pkg = await tx.advancedTravelPackage.update({
        where: { id, tenant_id: tenantId },
        data: updateData,
      });

      // 2. Replace sub-items
      if (data.sub_items !== undefined) {
        const existingSubItems = await tx.advancedPackageSubItem.findMany({ where: { package_id: id } });
        const incomingIds = (data.sub_items || []).map(si => si.id).filter(id => id);

        const toDelete = existingSubItems.filter(si => !incomingIds.includes(si.id));
        for (const si of toDelete) {
          await tx.advancedPackageSubItem.delete({ where: { id: si.id } });
        }

        if (Array.isArray(data.sub_items)) {
          for (const [idx, si] of data.sub_items.entries()) {
            if (si.id) {
              await tx.advancedPackageSubItem.update({
                where: { id: si.id },
                data: {
                  title: si.title,
                  description: si.description || null,
                  price: parseFloat(si.price) || 0,
                  custom_prices: si.has_custom_prices !== undefined ? (si.has_custom_prices ? si.custom_prices : null) : undefined,
                  include_travel_cost: si.include_travel_cost !== undefined ? (si.include_travel_cost ? 1 : 0) : undefined,
                  travel_cost_context: si.travel_cost_context !== undefined ? si.travel_cost_context : undefined,
                  sort_order: idx,
                  slot_mode: si.slot_mode || 'inherit',
                  slot_daily: si.slot_daily ? parseInt(si.slot_daily) : null,
                  slot_total: si.slot_total ? parseInt(si.slot_total) : null,
                  status: 'active',
                }
              });
              
              await tx.packageAvailabilityRule.deleteMany({ where: { package_id: id, sub_item_id: si.id } });
              if (Array.isArray(si.availability_rules) && si.availability_rules.length > 0) {
                await tx.packageAvailabilityRule.createMany({
                  data: si.availability_rules.map(rule => ({
                    tenant_id: tenantId,
                    package_id: id,
                    sub_item_id: si.id,
                    rule_type: rule.rule_type,
                    rule_value: rule.rule_value,
                    is_unavailable: rule.is_unavailable !== undefined ? (rule.is_unavailable ? 1 : 0) : 1,
                  }))
                });
              }
            } else {
              const createdSi = await tx.advancedPackageSubItem.create({
                data: {
                  tenant_id: tenantId,
                  package_id: id,
                  title: si.title,
                  description: si.description || null,
                  price: parseFloat(si.price) || 0,
                  custom_prices: si.has_custom_prices ? si.custom_prices : null,
                  include_travel_cost: si.include_travel_cost ? 1 : 0,
                  travel_cost_context: si.travel_cost_context || null,
                  sort_order: idx,
                  slot_mode: si.slot_mode || 'inherit',
                  slot_daily: si.slot_daily ? parseInt(si.slot_daily) : null,
                  slot_total: si.slot_total ? parseInt(si.slot_total) : null,
                  status: 'active',
                }
              });

              if (Array.isArray(si.availability_rules) && si.availability_rules.length > 0) {
                await tx.packageAvailabilityRule.createMany({
                  data: si.availability_rules.map(rule => ({
                    tenant_id: tenantId,
                    package_id: id,
                    sub_item_id: createdSi.id,
                    rule_type: rule.rule_type,
                    rule_value: rule.rule_value,
                    is_unavailable: rule.is_unavailable !== undefined ? (rule.is_unavailable ? 1 : 0) : 1,
                  }))
                });
              }
            }
          }
        }
      }

      // 3. Replace availability rules
      if (data.availability_rules !== undefined) {
        await tx.packageAvailabilityRule.deleteMany({ where: { package_id: id, sub_item_id: null } });
        if (Array.isArray(data.availability_rules) && data.availability_rules.length > 0) {
          await tx.packageAvailabilityRule.createMany({
            data: data.availability_rules.map((rule) => ({
              tenant_id: tenantId,
              package_id: id,
              sub_item_id: null,
              rule_type: rule.rule_type,
              rule_value: rule.rule_value,
              is_unavailable: rule.is_unavailable !== undefined ? (rule.is_unavailable ? 1 : 0) : 1,
            })),
          });
        }
      }

      // 4. Replace slot overrides
      if (data.slot_overrides !== undefined) {
        await tx.packageSlotOverride.deleteMany({ where: { package_id: id } });
        if (Array.isArray(data.slot_overrides) && data.slot_overrides.length > 0) {
          await tx.packageSlotOverride.createMany({
            data: data.slot_overrides.map((so) => ({
              tenant_id: tenantId,
              package_id: id,
              override_date: new Date(so.override_date),
              slot_limit: parseInt(so.slot_limit),
            })),
          });
        }
      }

      // 5. Replace price overrides
      if (data.price_overrides !== undefined) {
        await tx.packagePriceOverride.deleteMany({ where: { package_id: id } });
        if (Array.isArray(data.price_overrides) && data.price_overrides.length > 0) {
          await tx.packagePriceOverride.createMany({
            data: data.price_overrides.map((po) => ({
              tenant_id: tenantId,
              package_id: id,
              sub_item_id: po.sub_item_id ? parseInt(po.sub_item_id) : null,
              override_date: new Date(po.override_date),
              override_price: parseFloat(po.override_price),
              context: po.context || null,
            })),
          });
        }
      }

      // 6. Replace addons
      if (data.addons !== undefined) {
        const existingAddons = await tx.advancedPackageAddon.findMany({ where: { package_id: id } });
        const incomingIds = (data.addons || []).map(a => a.id).filter(id => id);
        
        // Delete ones not in incoming
        const toDelete = existingAddons.filter(a => !incomingIds.includes(a.id));
        for (const a of toDelete) {
          await tx.advancedPackageAddon.delete({ where: { id: a.id } });
        }

        // Update or Create
        if (Array.isArray(data.addons)) {
          for (const [idx, addon] of data.addons.entries()) {
            if (addon.id) {
              await tx.advancedPackageAddon.update({
                where: { id: addon.id },
                data: {
                  title: addon.title,
                  description: addon.description || null,
                  price: addon.price ? parseFloat(addon.price) : 0,
                  is_free: addon.is_free ? 1 : 0,
                  sort_order: addon.sort_order !== undefined ? addon.sort_order : idx,
                  status: addon.status || 'active',
                }
              });
            } else {
              await tx.advancedPackageAddon.create({
                data: {
                  tenant_id: tenantId,
                  package_id: id,
                  title: addon.title,
                  description: addon.description || null,
                  price: addon.price ? parseFloat(addon.price) : 0,
                  is_free: addon.is_free ? 1 : 0,
                  sort_order: addon.sort_order !== undefined ? addon.sort_order : idx,
                  status: addon.status || 'active',
                }
              });
            }
          }
        }
      }

      return advancedPackageService.getById(tenantId, id);
    });

    // Trigger Vector Sync
    const getTravelText = (item) => item.include_travel_cost ? ' (TERMASUK TIKET PP / PERJALANAN' + (item.travel_cost_context ? ' - ' + item.travel_cost_context : '') + ')' : (item.travel_cost_context ? ' (Catatan Transport: ' + item.travel_cost_context + ')' : '');
    const getCustomPricesText = (item) => {
      if (!item.custom_prices || !Array.isArray(item.custom_prices)) return '';
      return ' Harga Khusus: ' + item.custom_prices.map(cp => cp.label + ' Rp ' + cp.price + (cp.include_travel_cost ? ' (TERMASUK TIKET PP)' : '')).join(', ');
    };
    let subItemsText = (fullPkg.sub_items || []).map(s => `- ${s.title}: Rp ${s.price}${getTravelText(s)}${getCustomPricesText(s)}${s.description ? ` — ${s.description}` : ''}`).join('\n');
    let addonsText = (fullPkg.addons || []).map(a => `- ${a.title}: Rp ${a.price}${a.description ? ` — ${a.description}` : ''}`).join('\n');
    const textRepresentation = `Paket Advanced: ${fullPkg.title}\nTipe: ${fullPkg.package_type}\nDeskripsi: ${fullPkg.description}\nKonteks AI: ${fullPkg.context_description || ''}\nInclude Perjalanan/Tiket PP: ${fullPkg.include_travel_cost ? 'YA' : 'TIDAK'}\nCatatan Transport: ${fullPkg.travel_cost_context || '-'}\nHarga Utama Khusus:${getCustomPricesText(fullPkg)}\nSub-Paket/Varian:\n${subItemsText}\nAdd-ons:\n${addonsText}`;
    upsertDocument(tenantId, 'AdvancedTravelPackage', fullPkg.id, textRepresentation).catch(err => console.error('Vector Upsert Error:', err.message));

    return fullPkg;
  },

  // ============================================================
  // DELETE package (cascades sub-items, rules, overrides)
  // ============================================================
  delete: async (tenantId, packageId) => {
    const result = await prisma.advancedTravelPackage.delete({
      where: { id: parseInt(packageId), tenant_id: tenantId },
    });

    // Trigger Vector Delete
    deleteDocument(tenantId, 'AdvancedTravelPackage', result.id).catch(err => console.error('Vector Delete Error:', err.message));

    return result;
  },

  // ============================================================
  // AI CONTEXT: Generate slot-aware context for RAG
  // ============================================================
  buildAIContext: async (tenantId, packageType) => {
    const packages = await prisma.advancedTravelPackage.findMany({
      where: { tenant_id: tenantId, package_type: packageType, status: 'active' },
      include: {
        sub_items: { where: { status: 'active' }, orderBy: { sort_order: 'asc' }, include: { files: true } },
        availability_rules: true,
        slot_overrides: true,
        price_overrides: true,
        addons: { where: { status: 'active' }, orderBy: { sort_order: 'asc' }, include: { files: true } },
        media_files: true,
      },
    });

    if (packages.length === 0) return '';

    // Mock contexts back for buildAIContext usage
    packages.forEach(pkg => {
      if (pkg.media_files && pkg.media_files.length > 0) {
        pkg.contexts = [{ id: pkg.id, context_label: "Media Pendukung", ai_summary: pkg.context_description, files: pkg.media_files }];
      } else {
        pkg.contexts = [];
      }
      
      if (pkg.sub_items) {
        pkg.sub_items.forEach(si => {
          si.contexts = si.files && si.files.length > 0 
            ? [{ id: si.id, context_label: "Media Pendukung", ai_summary: si.context_description, files: si.files }] 
            : [];
        });
      }
      
      if (pkg.addons) {
        pkg.addons.forEach(addon => {
          addon.contexts = addon.files && addon.files.length > 0 
            ? [{ id: addon.id, context_label: "Media Pendukung", ai_summary: addon.context_description, files: addon.files }] 
            : [];
        });
      }
    });

    if (packages.length === 0) return '';

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][today.getDay()];
    const dayOfMonth = String(today.getDate());
    const monthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    let context = `=== ADVANCED ${packageType.toUpperCase()} TOUR PACKAGES ===\n`;
    context += `ATURAN KETAT: HANYA gunakan informasi yang TERTULIS EKSPLISIT di data paket di bawah ini. DILARANG KERAS mengarang/mengasumsikan aturan seperti "minimal peserta", "minimum pax", atau syarat lain yang TIDAK tertulis di deskripsi atau konteks paket. Jika tidak ada aturan minimal peserta tertulis, maka TIDAK ADA minimal peserta.\n`;
    context += `ATURAN HARGA: DILARANG KERAS menyebutkan harga selain yang TERTULIS EKSPLISIT di data Sub-Paket atau Harga Khusus di bawah ini. JANGAN gunakan harga dari ingatan percakapan sebelumnya, deskripsi lama, atau asumsi. Jika harga tertulis "Rp 3.500.000" maka sebutkan PERSIS angka itu, JANGAN dibulatkan atau diubah.\n\n`;

    const formatRule = (type, value) => {
      switch(type) {
        case 'daily': return 'Setiap Hari';
        case 'weekly': return `Hari ${value}`;
        case 'monthly': return `Tanggal ${value} setiap bulan`;
        case 'yearly': return `Tanggal ${value} setiap tahun`;
        case 'specific_date':
        case 'available_date': return `Tanggal ${value}`;
        default: return value;
      }
    };

    for (const pkg of packages) {
      // Internal check: skip expired packages (masa berlaku NOT exposed to AI)
      if (pkg.validity_type === 'expiry_date' && pkg.expiry_date && new Date(pkg.expiry_date) < today) {
        continue;
      }

      // ── Helper: collect all available dates from rules ──
      const collectAvailableDates = (rules) => {
        const dates = new Set();
        for (const rule of rules) {
          if (rule.is_unavailable) continue; // only available rules
          if (rule.rule_type === 'available_date' || rule.rule_type === 'specific_date') {
            dates.add(rule.rule_value);
          } else if (rule.rule_type === 'available_range') {
            const [startStr, endStr] = rule.rule_value.split('|');
            const start = new Date(startStr);
            const end = new Date(endStr);
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
              dates.add(d.toISOString().split('T')[0]);
            }
          }
        }
        return dates;
      };

      // Build package text
      context += `\n--- ${pkg.title} ---\n`;
      context += `  Tipe Paket: ${packageType === 'private' ? 'Private Tour' : packageType === 'group' ? 'Group Tour' : packageType}\n`;
      context += `  Status: ${pkg.status === 'active' ? 'Aktif' : 'Nonaktif'}\n`;
      context += `  Deskripsi: ${pkg.description || '-'}\n`;
      
      // Inject min_pax/max_pax constraints
      if (pkg.min_pax && pkg.min_pax > 1) {
        context += `  ⚠️ Minimum Peserta (min_pax): ${pkg.min_pax} orang — JANGAN izinkan booking kurang dari jumlah ini!\n`;
      }
      if (pkg.max_pax && pkg.max_pax < 100) {
        context += `  Maksimum Peserta (max_pax): ${pkg.max_pax} orang\n`;
      }
      
      if (pkg.contexts && pkg.contexts.length > 0) {
        pkg.contexts.forEach((ctx, index) => {
          if (ctx.ai_summary) {
            context += `  [Konteks Paket (Grup ${index + 1})]: ${ctx.ai_summary}\n`;
          } else if (ctx.context_label) {
            context += `  [Konteks Paket (Grup ${index + 1} - Manual)]: ${ctx.context_label}\n`;
          }
        });
      }

      // Fix #3: Inject context_description manual dari admin meskipun tidak ada file upload
      if (pkg.context_description && pkg.context_description.trim() &&
          (!pkg.contexts || pkg.contexts.length === 0 || !pkg.contexts.some(c => c.ai_summary))) {
        context += `  [Konteks Tambahan Admin]: ${pkg.context_description}\n`;
      }

      // ══════════════════════════════════════════════════════════════
      // SCHEDULE ENABLED CHECK — Skip calendar/slot if disabled
      // ══════════════════════════════════════════════════════════════
      if (pkg.schedule_enabled === 0) {
        // Manual mode — use admin's departure description as context
        context += `  Jadwal Keberangkatan: ${pkg.departure_description || 'Hubungi admin untuk informasi jadwal keberangkatan.'}\n`;
      } else {
        // Check availability for NEW BOOKINGS today
        // Note: If today IS a departure date, the trip is already running — no new bookings
        let availableToday = true;
        if (pkg.availability_type === 'configured') {
          // In configured mode: only FUTURE dates accept new bookings
          // Today's departure date = trip already running, not bookable
          const availDates = collectAvailableDates(pkg.availability_rules);
          const hasUpcoming = [...availDates].some(d => d > todayStr);
          availableToday = hasUpcoming;
        } else if (pkg.availability_type === 'recurring') {
          // Recurring schedules always have a future upcoming day
          availableToday = true;
        }

        // Check slot availability
        let slotsAvailable = true;
        let slotInfo = '';
        if (pkg.slot_mode === 'configured') {
          if (pkg.slot_total && pkg.slot_used_total >= pkg.slot_total) {
            slotsAvailable = false;
            slotInfo = 'SLOT PENUH (total habis)';
          }
          const dailyOverride = pkg.slot_overrides.find(so => so.override_date.toISOString().split('T')[0] === todayStr);
          if (dailyOverride && dailyOverride.slot_used >= dailyOverride.slot_limit) {
            slotsAvailable = false;
            slotInfo = 'SLOT PENUH (hari ini)';
          }
        } else if (pkg.slot_mode === 'always_ask_admin') {
          slotInfo = 'Perlu konfirmasi admin';
        }

        // ── Describe availability (simplified: only "tersedia" dates) ──
        if (pkg.availability_type === 'confirmation_required') {
          context += `  Jadwal Keberangkatan: [WAJIB KONFIRMASI SISTEM]\n`;
          context += `    INSTRUKSI PENTING: Tanggal keberangkatan paket ini BEBAS (tidak dibatasi tanggal tertentu), NAMUN memerlukan konfirmasi dari admin/sistem. Jika kustomer menanyakan/meminta tanggal tertentu untuk paket ini, kamu WAJIB membalas bahwa kamu perlu mengecek jadwal terlebih dahulu. Di akhir balasanmu, sisipkan tag persis seperti ini: [REQUEST:date_confirmation:Paket ${pkg.title} untuk tanggal YYYY-MM-DD]. Sistem akan mengirimkannya ke dashboard admin.\n`;
          context += `    Contoh respons: "Baik Kak, untuk tanggal tersebut saya cek dulu ketersediaannya ya. Mohon ditunggu sebentar 🙏"\n`;
        } else if (pkg.availability_type === 'always') {
          context += `  Jadwal Keberangkatan: Tersedia setiap hari — pelanggan bebas pilih tanggal kapanpun.\n`;
        } else if (pkg.availability_type === 'recurring' && pkg.availability_rules.length > 0) {
          const ruleVal = pkg.availability_rules[0].rule_value;
          let desc = '';
          if (ruleVal === 'everyday') desc = 'Setiap Hari';
          else if (ruleVal === 'weekday') desc = 'Setiap Hari Kerja (Senin - Jumat)';
          else if (ruleVal === 'weekend') desc = 'Setiap Akhir Pekan (Sabtu & Minggu)';
          else {
            const dayMap = { monday:'Senin', tuesday:'Selasa', wednesday:'Rabu', thursday:'Kamis', friday:'Jumat', saturday:'Sabtu', sunday:'Minggu' };
            desc = 'Setiap hari ' + ruleVal.split(',').map(d => dayMap[d.trim()] || d).join(', ');
          }
          context += `  Jadwal Keberangkatan — Rutin tersedia: ${desc}\n`;
          context += `  PENTING — ATURAN TANGGAL KEBERANGKATAN (WAJIB DIPATUHI):\n`;
          context += `    1. Paket ini HANYA TERSEDIA sesuai jadwal rutin di atas (${desc}).\n`;
          context += `    2. Saat pertama kali menawarkan atau menyebutkan paket ini ke pelanggan, Anda WAJIB secara proaktif menyebutkan jadwal rutin tersebut (contoh: "Paket ini tersedia setiap hari Sabtu dan Minggu").\n`;
          context += `    3. DILARANG KERAS bertanya "rencananya mau pergi kapan?" atau "mau berangkat tanggal berapa?" karena pola hari jadwalnya sudah FIX. Langsung beritahu hari apa saja paket ini berangkat.\n`;
        } else if (pkg.availability_type === 'configured' && pkg.availability_rules.length > 0) {
          // Collect all available dates
          const availDates = collectAvailableDates(pkg.availability_rules);
          // Filter only STRICTLY FUTURE dates (exclude today — today's trip is already running)
          const futureDates = [...availDates].filter(d => d > todayStr).sort();

          if (futureDates.length > 0) {
            // Smart Range Summarizer: group consecutive dates into ranges
            const summarizeDateRanges = (dates) => {
              const ranges = [];
              let rangeStart = dates[0];
              let rangeEnd = dates[0];

              for (let i = 1; i < dates.length; i++) {
                const prevDate = new Date(rangeEnd + 'T00:00:00');
                const currDate = new Date(dates[i] + 'T00:00:00');
                const diffDays = (currDate - prevDate) / (1000 * 60 * 60 * 24);
                
                if (diffDays === 1) {
                  // Consecutive — extend range
                  rangeEnd = dates[i];
                } else {
                  // Gap — save current range, start new one
                  ranges.push({ start: rangeStart, end: rangeEnd });
                  rangeStart = dates[i];
                  rangeEnd = dates[i];
                }
              }
              ranges.push({ start: rangeStart, end: rangeEnd });
              return ranges;
            };

            const formatDateShort = (dateStr) => {
              const d = new Date(dateStr + 'T00:00:00');
              return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            };

            const ranges = summarizeDateRanges(futureDates);
            context += `  Jadwal Keberangkatan — HANYA tersedia pada tanggal berikut:\n`;
            
            for (const range of ranges) {
              if (range.start === range.end) {
                context += `    ✅ ${formatDateShort(range.start)}\n`;
              } else {
                context += `    ✅ ${formatDateShort(range.start)} s/d ${formatDateShort(range.end)}\n`;
              }
            }

            context += `  PENTING — ATURAN TANGGAL KEBERANGKATAN (WAJIB DIPATUHI):\n`;
            context += `    1. Selain tanggal di atas, paket ini TIDAK TERSEDIA. Jangan katakan ke pelanggan bahwa mereka bebas pilih tanggal.\n`;
            context += `    2. Tanggal di atas adalah TANGGAL KEBERANGKATAN (tanggal mulai trip), BUKAN durasi/lama perjalanan. Jika pelanggan salah paham (misal: "perginya dari tanggal 1-10 Juni?" padahal itu 10 pilihan tanggal berangkat), JELASKAN bahwa itu adalah pilihan tanggal keberangkatan yang tersedia, dan durasi trip sesuai dengan deskripsi paket.\n`;
            context += `    3. Saat pertama kali menawarkan atau menyebutkan paket ini ke pelanggan, Anda WAJIB secara proaktif menyebutkan tanggal-tanggal yang tersedia di atas.\n`;
            context += `    4. DILARANG KERAS bertanya "rencananya mau pergi kapan?" atau "mau berangkat tanggal berapa?". Karena paket ini jadwalnya sudah FIX, Anda harus langsung menyodorkan opsi tanggalnya, BUKAN bertanya ke pelanggan.\n`;
          } else {
            context += `  Jadwal Keberangkatan: Semua jadwal sudah lewat. Tidak tersedia untuk saat ini.\n`;
          }
        } else {
          context += `  Jadwal Keberangkatan: Hubungi admin untuk jadwal pasti.\n`;
        }

        context += `  Status Hari Ini: ${availableToday ? '✅ Tersedia' : '❌ Tidak Tersedia Hari Ini'}\n`;

        if (!slotsAvailable) {
          context += `  ⚠️ ${slotInfo} — JANGAN TAWARKAN PAKET INI\n`;
          continue;
        }
        if (slotInfo) {
          context += `  Info Slot: ${slotInfo}\n`;
        }
      }

      // Price info
      const todayPriceOverride = pkg.price_overrides.find(po => !po.sub_item_id && po.override_date.toISOString().split('T')[0] === todayStr);
      if (pkg.has_sub_items && pkg.sub_items.length > 0) {
        context += `  Sub-Paket:\n`;
        for (const si of pkg.sub_items) {
          // Check sub-item slot
          let siAvailable = true;
          if (si.slot_mode === 'configured' && si.slot_total && si.slot_used_total >= si.slot_total) {
            siAvailable = false;
          }
          const siPriceOverride = pkg.price_overrides.find(po => po.sub_item_id === si.id && po.override_date.toISOString().split('T')[0] === todayStr);
          const siPrice = siPriceOverride ? parseFloat(siPriceOverride.override_price) : parseFloat(si.price);
          const priceStr = siPrice > 0 ? `Rp ${siPrice.toLocaleString('id-ID')}` : 'Hubungi admin';

          if (!siAvailable) {
            context += `    ❌ ${si.title}: SLOT PENUH — Jangan tawarkan\n`;
          } else {
            const priceContext = siPriceOverride?.context ? ` (Konteks Harga: ${siPriceOverride.context})` : '';
            
            let siSchedule = '';
            if (si.availability_type === 'configured') {
              const rules = pkg.availability_rules.filter(r => r.sub_item_id === si.id);
              if (rules.length > 0) {
                let siAvail = [];
                let siUnavail = [];
                for (const rule of rules) {
                  const text = formatRule(rule.rule_type, rule.rule_value);
                  if (rule.is_unavailable) siUnavail.push(text);
                  else siAvail.push(text);
                }
                if (siAvail.length > 0) siSchedule += ` [Jadwal Tersedia: ${siAvail.join(', ')}]`;
                if (siUnavail.length > 0) siSchedule += ` [Libur/Tutup: ${siUnavail.join(', ')}]`;
              }
            } else if (si.availability_type === 'confirmation_required') {
              siSchedule = ' [WAJIB KONFIRMASI SISTEM]';
              context += `      INSTRUKSI PENTING: Jika kustomer memilih sub-paket ini, kamu WAJIB membalas bahwa kamu perlu mengecek jadwal terlebih dahulu dengan menyisipkan tag: [REQUEST:date_confirmation:Sub-Paket ${si.title} untuk tanggal YYYY-MM-DD].\n`;
            } else if (si.availability_type === 'always') {
              siSchedule = ' [Tersedia setiap hari]';
            } else if (si.availability_type === 'recurring') {
              const rules = pkg.availability_rules.filter(r => r.sub_item_id === si.id && r.rule_type === 'recurring');
              if (rules.length > 0) {
                const ruleVal = rules[0].rule_value;
                let desc = '';
                if (ruleVal === 'everyday') desc = 'Setiap Hari';
                else if (ruleVal === 'weekday') desc = 'Setiap Hari Kerja (Senin - Jumat)';
                else if (ruleVal === 'weekend') desc = 'Setiap Akhir Pekan (Sabtu & Minggu)';
                else {
                   const daysMap = { monday: 'Senin', tuesday: 'Selasa', wednesday: 'Rabu', thursday: 'Kamis', friday: 'Jumat', saturday: 'Sabtu', sunday: 'Minggu' };
                   desc = 'Setiap hari ' + ruleVal.split(',').map(d => daysMap[d] || d).join(', ');
                }
                siSchedule = ` [Jadwal Rutin: ${desc}]`;
              } else {
                siSchedule = ' [Jadwal Rutin belum dikonfigurasi]';
              }
            }
            let siTravelContext = '';
            if (si.include_travel_cost) {
              siTravelContext = ` [SUDAH TERMASUK BIAYA PERJALANAN / TIKET PP]`;
              if (si.travel_cost_context) {
                siTravelContext += ` (Catatan Transport: ${si.travel_cost_context})`;
              }
            } else if (si.travel_cost_context) {
              siTravelContext = ` [Catatan Transport: ${si.travel_cost_context}]`;
            }
            context += `    ✅ ${si.title}: ${priceStr}${priceContext} — ${si.description || ''}${siSchedule}${siTravelContext}\n`;
            if (si.custom_prices && Array.isArray(si.custom_prices) && si.custom_prices.length > 0) {
              context += `      Harga Khusus Sub-Paket ${si.title}:\n`;
              si.custom_prices.forEach(cp => {
                 const cpPrice = cp.price ? `Rp ${parseInt(cp.price).toLocaleString('id-ID')}` : 'Gratis / Hubungi Admin';
                 const cpTravel = cp.include_travel_cost ? '(Termasuk biaya perjalanan)' : '(Belum termasuk biaya perjalanan)';
                 const cpTravelContext = cp.travel_cost_context ? ` - Catatan: ${cp.travel_cost_context}` : '';
                 context += `        - ${cp.label}: ${cpPrice} ${cpTravel}${cpTravelContext}\n`;
              });
            }
            if (si.contexts && si.contexts.length > 0) {
              si.contexts.forEach((ctx, index) => {
                if (ctx.ai_summary) {
                  context += `      [Konteks Sub-Paket (Grup ${index + 1})]: ${ctx.ai_summary}\n`;
                } else if (ctx.context_label) {
                  context += `      [Konteks Sub-Paket (Grup ${index + 1} - Manual)]: ${ctx.context_label}\n`;
                }
              });
            }
          }
        }
      } else {
        const price = todayPriceOverride ? parseFloat(todayPriceOverride.override_price) : parseFloat(pkg.price);
        const priceStr = price > 0 ? `Rp ${price.toLocaleString('id-ID')}` : 'Hubungi admin';
        const priceContext = todayPriceOverride?.context ? ` (Konteks Harga: ${todayPriceOverride.context})` : '';
        let mainTravelContext = '';
        if (pkg.include_travel_cost) {
          mainTravelContext = ` [SUDAH TERMASUK BIAYA PERJALANAN / TIKET PP]`;
          if (pkg.travel_cost_context) {
            mainTravelContext += ` (Catatan Transport: ${pkg.travel_cost_context})`;
          }
        } else if (pkg.travel_cost_context) {
          mainTravelContext = ` [Catatan Transport: ${pkg.travel_cost_context}]`;
        }
        context += `  Harga: ${priceStr}${priceContext}${mainTravelContext}\n`;
        
        if (pkg.custom_prices && Array.isArray(pkg.custom_prices) && pkg.custom_prices.length > 0) {
          context += `  Harga Khusus Tambahan (Selain harga reguler):\n`;
          pkg.custom_prices.forEach(cp => {
             const cpPrice = cp.price ? `Rp ${parseInt(cp.price).toLocaleString('id-ID')}` : 'Gratis / Hubungi Admin';
             const cpTravel = cp.include_travel_cost ? '(Termasuk biaya perjalanan)' : '(Belum termasuk biaya perjalanan)';
             const cpTravelContext = cp.travel_cost_context ? ` - Catatan: ${cp.travel_cost_context}` : '';
             context += `    - ${cp.label}: ${cpPrice} ${cpTravel}${cpTravelContext}\n`;
          });
        }
      }

      // Addons info
      if (pkg.addons && pkg.addons.length > 0) {
        context += `  Layanan Tambahan (Addons) Tersedia:\n`;
        context += `    [INSTRUKSI PENTING]: Jika pelanggan menunjukkan ketertarikan atau sudah mantap memilih paket ini, Anda WAJIB menawarkan opsi layanan tambahan (Addon) di bawah ini secara proaktif untuk memaksimalkan pengalaman liburan mereka.\n`;
        for (const addon of pkg.addons) {
          const priceStr = addon.is_free ? 'GRATIS' : (parseFloat(addon.price) > 0 ? `Rp ${parseFloat(addon.price).toLocaleString('id-ID')}` : 'Hubungi admin');
          context += `    - ${addon.title} (${priceStr}): ${addon.description || ''}\n`;
          if (addon.contexts && addon.contexts.length > 0) {
            addon.contexts.forEach((ctx, index) => {
              if (ctx.ai_summary) {
                context += `      [Konteks Addon (Grup ${index + 1})]: ${ctx.ai_summary}\n`;
              } else if (ctx.context_label) {
                context += `      [Konteks Addon (Grup ${index + 1} - Manual)]: ${ctx.context_label}\n`;
              }
            });
          }
        }
      }

      // Media Pendukung (titles only — AI reads summary on-demand)
      if (pkg.contexts && pkg.contexts.some(c => c.files && c.files.length > 0)) {
        context += `  Media Pendukung Tersedia:\n`;
        pkg.contexts.forEach(ctx => {
          if (ctx.files) {
            for (const mf of ctx.files) {
              const typeLabel = mf.file_type?.includes('image') ? 'Gambar'
                              : mf.file_type?.includes('pdf') ? 'PDF'
                              : mf.file_type?.includes('video') ? 'Video'
                              : 'Dokumen';
              context += `    - [MEDIA_ID:${mf.id}] ${mf.file_name} (${typeLabel})\n`;
            }
          }
        });
        context += `  INSTRUKSI MEDIA: Jika kamu ingin mengirimkan salah satu media di atas ke pelanggan (misal: poster promosi, brosur, itinerary), tambahkan tag [SEND_PKG_MEDIA:${pkg.id}:MEDIA_ID] di akhir balasanmu. Ganti MEDIA_ID dengan ID media yang relevan.\n`;
      }
    }
    const textContext = context.trim();
    let sections = { deskripsi: '', jadwal: '', harga: '', sub_paket: '', addon: '', slot: '', status: '' };
    let currentState = 'deskripsi';
    
    for (const line of textContext.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('Sub-Paket:')) currentState = 'sub_paket';
      else if (trimmed.startsWith('Layanan Tambahan (Addons)')) currentState = 'addon';
      else if (trimmed.startsWith('Jadwal Keberangkatan')) currentState = 'jadwal';
      else if (trimmed.startsWith('Harga:')) currentState = 'harga';
      else if (trimmed.startsWith('Status Hari Ini:') || trimmed.startsWith('Status:')) currentState = 'status';
      else if (trimmed.startsWith('Info Slot:') || trimmed.includes('SLOT PENUH')) currentState = 'slot';
      else if (trimmed.startsWith('---') || trimmed.startsWith('===') || trimmed.startsWith('Tipe Paket:') || trimmed.startsWith('Deskripsi:')) currentState = 'deskripsi';
      
      if (sections[currentState] !== undefined) {
        sections[currentState] += line + '\n';
      }
    }

    return {
      text: textContext,
      structured: {
        packageTitle: packages.map(p => p.title).join(', '),
        sections: sections
      }
    };
  },
};
