import SharedLayout from '@/layouts/SharedLayout';

/**
 * ================================================================
 * TravelLayout
 * ================================================================
 * Layout variant for business_type = 'travel'.
 * This is the DEFAULT layout (legacy klien_gec used Travel AI).
 * Extends SharedLayout with travel-specific sidebar widgets.
 * ================================================================
 */
const TravelLayout = () => {
  const travelWidgets = null;

  return <SharedLayout extraWidgets={travelWidgets} />;
};

export default TravelLayout;
