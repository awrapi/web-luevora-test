import React, { useState, useEffect } from 'react';

/* â”€â”€â”€ Typing Effect Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const TypewriterText = ({ text, Tag = 'h1', customStyle = {}, active = true }) => {
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    // Don't start until active
    if (!active) return;

    let timeout;

    if (!isDeleting && charIndex < text.length) {
      // Mengetik
      timeout = setTimeout(() => {
        setDisplayText(text.slice(0, charIndex + 1));
        setCharIndex(charIndex + 1);
      }, 45);
    } else if (!isDeleting && charIndex === text.length) {
      // Selesai mengetik â€” jeda 6 detik sebelum menghapus
      timeout = setTimeout(() => {
        setIsDeleting(true);
      }, 6000);
    } else if (isDeleting && charIndex > 0) {
      // Menghapus
      timeout = setTimeout(() => {
        setDisplayText(text.slice(0, charIndex - 1));
        setCharIndex(charIndex - 1);
      }, 25);
    } else if (isDeleting && charIndex === 0) {
      // Selesai menghapus â€” jeda 1 detik sebelum mengetik ulang
      timeout = setTimeout(() => {
        setIsDeleting(false);
      }, 1000);
    }

    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, text, active]);

  return (
    <Tag style={{ ...customStyle }}>
      {displayText}
      <span
        style={{
          display: active ? 'inline-block' : 'none',
          width: '3px',
          height: '1em',
          backgroundColor: '#3b82f6',
          marginLeft: '2px',
          verticalAlign: 'text-bottom',
          animation: 'cursor-blink 0.7s step-end infinite',
        }}
      />
      <style>{`
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>
    </Tag>
  );
};

export default TypewriterText;
