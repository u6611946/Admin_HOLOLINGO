import './globals.css';
import { ThemeProvider } from './ThemeContext'; // sits at src/app/ThemeContext.js

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}