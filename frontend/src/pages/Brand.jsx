import { useEffect } from 'react';
import combinedHtml from '../assets/brand/combined.html?raw';

export default function Brand() {
  useEffect(() => {
    // Replace the entire document with the self-contained brand HTML.
    // This avoids iframe rendering issues and works reliably on all browsers.
    document.open('text/html', 'replace');
    document.write(combinedHtml);
    document.close();
  }, []);

  return null;
}
