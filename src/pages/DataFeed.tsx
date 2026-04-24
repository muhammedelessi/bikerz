import { useEffect } from 'react';

const FEED_URL =
  'https://gifovgwlxwuiibfzyvwb.supabase.co/functions/v1/meta-product-feed';

const DataFeed: React.FC = () => {
  useEffect(() => {
    window.location.replace(FEED_URL);
  }, []);

  return null;
};

export default DataFeed;
