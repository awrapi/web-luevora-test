import React from 'react';

const FooterSection = () => {
  return (
    <footer className="lp-footer" style={{
      width: '100%',
      backgroundColor: '#000000',
      backgroundImage: "url('/assets/Cloudy.svg')",
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      color: '#ffffff',
      padding: '40px 60px',
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '40px'
    }}>
      {/* Left Column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '1 1 300px' }}>
        <p style={{ margin: 0, fontSize: '13px', color: '#e0e0e0', fontWeight: 600 }}>Luevora - Karyawan AI Pertama Kamu. &nbsp;|&nbsp; Contact us: contact@luevora.com</p>
        <p style={{ margin: 0, fontSize: '13px', color: '#e0e0e0', fontWeight: 600 }}>&copy; 2026 Luevora AI. All rights reserved</p>
        <div className="lp-footer-logo-wrap" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
          <img src="/luevora.png" alt="Luevora Logo" loading="lazy" style={{ width: '20px', height: '20px' }} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>Luevora AI | Empowering your business frontline</span>
        </div>
      </div>

      <div className="lp-footer-links-wrap" style={{ display: 'flex', alignItems: 'center', gap: '40px', flexWrap: 'wrap' }}>
        {/* Center Column */}
        <div className="lp-footer-center" style={{ display: 'flex', alignItems: 'center', gap: '20px', borderLeft: '3px solid #ffffff', paddingLeft: '20px', height: '70px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <a href="/privacy-policy" style={{ color: '#ffffff', textDecoration: 'none', fontSize: '13px', fontWeight: 600, transition: 'opacity 0.2s ease' }} onMouseEnter={e => e.currentTarget.style.opacity = 0.7} onMouseLeave={e => e.currentTarget.style.opacity = 1}>Privacy Policy</a>
            <a href="/terms-of-service" style={{ color: '#ffffff', textDecoration: 'none', fontSize: '13px', fontWeight: 600, transition: 'opacity 0.2s ease' }} onMouseEnter={e => e.currentTarget.style.opacity = 0.7} onMouseLeave={e => e.currentTarget.style.opacity = 1}>Terms of Service</a>
          </div>
        </div>

        {/* Right Column */}
        <div className="lp-footer-right" style={{ display: 'flex', alignItems: 'center', gap: '20px', borderLeft: '3px solid #ffffff', paddingLeft: '20px', height: '70px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <a href="#" style={{ color: '#ffffff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', transition: 'opacity 0.2s ease' }} onMouseEnter={e => e.currentTarget.style.opacity = 0.7} onMouseLeave={e => e.currentTarget.style.opacity = 1}>
              <div style={{ background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)', borderRadius: '4px', display: 'flex', padding: '2px' }}>
                <InstagramIcon size={14} color="white" />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700 }}>Luevora.id</span>
            </a>
            <a href="#" style={{ color: '#ffffff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', transition: 'opacity 0.2s ease' }} onMouseEnter={e => e.currentTarget.style.opacity = 0.7} onMouseLeave={e => e.currentTarget.style.opacity = 1}>
              <div style={{ background: '#0077b5', borderRadius: '2px', display: 'flex', padding: '2px' }}>
                <LinkedinIcon size={14} color="white" />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700 }}>Luevora</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

const InstagramIcon = ({ size, color }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);


const LinkedinIcon = ({ size, color }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
    <rect x="2" y="9" width="4" height="12"></rect>
    <circle cx="4" cy="4" r="2"></circle>
  </svg>
);

export default FooterSection;
