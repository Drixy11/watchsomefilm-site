export const metadata = {
  title: 'Watch Some Film',
  description: 'Football intelligence, camp access, and tools built for coaches and players.',
};

import './globals.css';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
