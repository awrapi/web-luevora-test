import React from 'react';
import { Link } from 'react-router-dom';

const TermsOfService = () => {
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
        <h1 style={{ fontSize: '40px', fontWeight: 800, marginBottom: '20px' }}>Terms of Use</h1>
        <p style={{ color: '#555', marginBottom: '40px' }}><strong>Effective Date:</strong> June 2026</p>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>1. Acceptance of Terms</h2>
          <p>By accessing the Luevora AI platform, signing up for the Founding Access program, or integrating our services into your business, you agree to be bound by these Terms of Use.</p>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>2. Description of Service</h2>
          <p>Luevora provides an AI-powered frontline management system that automates customer interactions, reservation/booking management, inventory monitoring, CRM updates, and business performance analytics through a centralized dashboard.</p>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>3. Subscriptions and Payments</h2>
          <p style={{ marginBottom: '12px' }}><strong>Billing:</strong> Services are billed automatically through our integrated payment gateway on a recurring basis (monthly or annually) according to your selected plan.</p>
          <p style={{ marginBottom: '12px' }}><strong>Founding Access Promotions:</strong> Discounts or special offers obtained through the Founding Access program (such as the 50% launch discount or free trials) are subject to the specific promotional duration communicated during sign-up.</p>
          <p><strong>Refund Policy:</strong> All charges paid are strictly non-refundable unless required by applicable law. You may cancel your subscription at any time to prevent the next billing cycle.</p>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>4. Acceptable Use</h2>
          <p>You agree to use Luevora strictly for lawful and legitimate business purposes. You are strictly prohibited from using the AI to distribute spam, conduct fraudulent activities, or violate the terms of service of our integrated third-party platforms (e.g., Meta or Telegram terms).</p>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>5. Limitation of Liability and AI Disclaimer</h2>
          <p style={{ marginBottom: '12px' }}><strong>AI Performance:</strong> While Luevora AI is designed for high accuracy and features "Human in the Loop" routing, artificial intelligence can technically produce inaccurate or unexpected responses (AI hallucinations).</p>
          <p style={{ marginBottom: '12px' }}><strong>Third-Party API Reliance:</strong> The core conversational capabilities of Luevora rely on third-party LLM APIs. Luevora is not liable for temporary service interruptions, latency, or operational outages caused directly by server issues from these third-party API providers.</p>
          <p style={{ marginBottom: '12px' }}><strong>Final Approval:</strong> You acknowledge that the final decision and approval for crucial transactions, financial data, product package creation, or special customer requests within the dashboard remain the sole responsibility of the human business owner or admin.</p>
          <p><strong>Liability Limits:</strong> Luevora AI shall not be held liable for any financial losses, loss of profit, loss of data, or operational impacts arising from the automated actions or system dysfunctions of the AI.</p>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>6. Intellectual Property</h2>
          <p>Luevora retains full ownership rights to the platform’s software, AI engine, interface designs, and dashboard systems. You, as the client, retain full ownership of the business data, SOPs, training materials, and customer data you input into our system.</p>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>7. Account Termination</h2>
          <p>Luevora reserves the right to suspend or terminate your account immediately without prior notice if you are found to have breached these Terms of Use or engaged in activities that compromise the integrity of our network.</p>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ backgroundColor: '#000', color: '#fff', padding: '40px', textAlign: 'center', fontSize: '13px' }}>
        <p>© 2026 Luevora AI. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default TermsOfService;
