import React from 'react';
import { Link } from 'react-router-dom';

const PrivacyPolicy = () => {
  return (
    <div style={{ backgroundColor: '#fff', minHeight: '100vh', color: '#111', fontFamily: "'Satoshi', 'Inter', 'Segoe UI', sans-serif" }}>
      {/* Header */}
      <header style={{ padding: '20px 40px', borderBottom: '1px solid #eaeaea', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/luevora.png" alt="Luevora Logo" style={{ width: '30px', height: '30px' }} />
          <span style={{ fontSize: '20px', fontWeight: 800, color: '#0d0d1a', letterSpacing: '-0.02em' }}>
            LUEVORA AI
          </span>
        </div>
        <Link to="/" style={{ textDecoration: 'none', color: '#0d0d1a', fontWeight: 600, padding: '8px 16px', borderRadius: '6px', transition: 'background 0.2s ease' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f0f0f0'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
          Back to Home
        </Link>
      </header>

      {/* Content */}
      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '60px 20px', lineHeight: 1.8 }}>
        <h1 style={{ fontSize: '40px', fontWeight: 800, marginBottom: '20px' }}>Privacy Policy</h1>
        <p style={{ color: '#555', marginBottom: '40px' }}><strong>Effective Date:</strong> June 2026</p>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>1. Introduction</h2>
          <p>Welcome to Luevora AI. We are fully committed to protecting the privacy of our clients (business owners) and end-users (your customers). This Privacy Policy explains how we collect, use, process, and safeguard your data when you use the Luevora AI platform, dashboard, and integrated omnichannel services.</p>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>2. Information We Collect</h2>
          <p style={{ marginBottom: '12px' }}><strong>Account & Payment Information:</strong> When you register or subscribe, we collect your name, business email, and company details. All payment processing is securely handled by our integrated third-party payment gateway; we do not store your full credit card numbers or payment details on our servers.</p>
          <p style={{ marginBottom: '12px' }}><strong>Business Data (Knowledge Base):</strong> Information you provide to train your AI, including SOPs, business rules, documents uploaded via the AI Agent Talk Session, and historical data imported through the "Bring Your Old Data" feature.</p>
          <p><strong>End-User (Customer) Data:</strong> Chat histories, contact information, and reservation details generated when your customers interact with the AI across connected platforms (e.g., WhatsApp, Instagram, Telegram, LINE, Facebook, and Email).</p>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>3. How We Use Your Information</h2>
          <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
            <li style={{ marginBottom: '8px' }}>To operate, maintain, and personalize your AI frontliner functions and dashboard operations.</li>
            <li style={{ marginBottom: '8px' }}>To process automated bookings, update your CRM system, and execute commands via the AI Business Copilot.</li>
            <li style={{ marginBottom: '8px' }}>To process recurring subscription payments and automatically issue invoices or receipts.</li>
          </ul>
          <p><strong>Important Note:</strong> Your internal business data and customer conversation histories are strictly isolated and will never be used to train our global baseline AI models without your explicit consent.</p>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>4. Data Sharing & Third-Party Integrations</h2>
          <p style={{ marginBottom: '12px' }}><strong>Platform Integrations:</strong> Luevora connects with various third-party APIs (such as Meta for WhatsApp/Instagram, Telegram, LINE, and our payment gateway). Data transmitted through these channels is subject to the respective privacy policies of those platforms. We never sell your data to third-party advertisers.</p>
          <p><strong>Third-Party AI & LLM Providers:</strong> To power the conversational intelligence and automated text processing of Luevora, we utilize Large Language Model (LLM) APIs from trusted third-party providers. Incoming chat queries and relevant segments of your Knowledge Base are securely transmitted to these providers strictly for real-time processing. Our agreements with these API providers ensure that your data is not stored or used to train their public AI models.</p>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>5. Data Security</h2>
          <p>We implement strict, industry-standard encryption protocols to protect your business and customer data against unauthorized access, alteration, disclosure, or destruction.</p>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>6. Your Rights</h2>
          <p>You hold the full right to access, modify, or request the deletion of your account and associated data. Upon subscription cancellation, you may request a complete data wipe ("Right to be Forgotten") from our active servers.</p>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ backgroundColor: '#000', color: '#fff', padding: '40px', textAlign: 'center', fontSize: '13px' }}>
        <p>© 2026 Luevora AI. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default PrivacyPolicy;
