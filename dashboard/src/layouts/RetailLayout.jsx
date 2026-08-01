import SharedLayout from '@/layouts/SharedLayout';

/**
 * ================================================================
 * RetailLayout
 * ================================================================
 * Layout variant for business_type = 'retail'.
 * Extends SharedLayout with retail-specific sidebar widgets
 * (e.g., low stock alerts, daily revenue).
 * ================================================================
 */
const RetailLayout = () => {
  const retailWidgets = (
    <>
      <div className="widget widget--stock-alert">
        <h4>Stok Menipis</h4>
        <p className="widget-placeholder">— Widget placeholder —</p>
      </div>
      <div className="widget widget--daily-revenue">
        <h4>Revenue Hari Ini</h4>
        <p className="widget-placeholder">— Widget placeholder —</p>
      </div>
    </>
  );

  return <SharedLayout extraWidgets={retailWidgets} />;
};

export default RetailLayout;
