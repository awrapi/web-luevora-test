import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || '';

const FoundingAccess = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    whatsapp: '',
    email: '',
    businessType: 'klinik'
  });
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch(`${API_URL}/public/founding-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit registration');
      }

      setStatus('success');
    } catch (err) {
      setErrorMessage(err.message);
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div style={{ backgroundColor: '#fff', minHeight: '100vh', color: '#111', fontFamily: "'Satoshi', 'Inter', 'Segoe UI', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: '500px', padding: '40px' }}>
          <div style={{ width: '80px', height: '80px', background: '#e0e7ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <span style={{ fontSize: '40px' }}>🎉</span>
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '16px' }}>Thank You!</h1>
          <p style={{ color: '#555', marginBottom: '32px', lineHeight: 1.6 }}>Your expression of interest for the Founding Access program has been received. We will contact you soon!</p>
          <Link to="/" style={{ display: 'inline-block', backgroundColor: '#0d0d1a', color: '#fff', textDecoration: 'none', padding: '14px 28px', borderRadius: '8px', fontWeight: 600 }}>Back to Home</Link>
        </div>
      </div>
    );
  }

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
      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '60px 20px', lineHeight: 1.8 }}>
        <h1 style={{ fontSize: '40px', fontWeight: 800, marginBottom: '16px', textAlign: 'center' }}>Join Founding Access</h1>
        
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '40px', textAlign: 'center' }}>
          <p style={{ color: '#334155', fontSize: '15px' }}>
            <strong>100% Free. No hidden fees.</strong><br/>
            This registration is purely an expression of interest to join Luevora. By registering now, you secure an exclusive opportunity to receive a <strong>Free Trial</strong> and a <strong>50% subscription discount</strong> when we officially launch!
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>Full Name</label>
            <input 
              type="text" 
              name="fullName" 
              value={formData.fullName} 
              onChange={handleChange} 
              required 
              style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', outline: 'none' }}
              placeholder="e.g. John Doe"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>WhatsApp Number</label>
            <input 
              type="tel" 
              name="whatsapp" 
              value={formData.whatsapp} 
              onChange={handleChange} 
              required 
              style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', outline: 'none' }}
              placeholder="e.g. 08123456789"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>Email Address</label>
            <input 
              type="email" 
              name="email" 
              value={formData.email} 
              onChange={handleChange} 
              required 
              style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', outline: 'none' }}
              placeholder="e.g. john@example.com"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>Business Type</label>
            <select 
              name="businessType" 
              value={formData.businessType} 
              onChange={handleChange}
              style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', outline: 'none', backgroundColor: '#fff' }}
            >
              <option value="klinik">Klinik (Clinic)</option>
              <option value="rental">Rental</option>
              <option value="travel">Travel</option>
              <option value="course">Course / Education</option>
              <option value="online product">Online Product / Retail</option>
            </select>
          </div>

          {status === 'error' && (
            <div style={{ color: '#dc2626', background: '#fee2e2', padding: '12px', borderRadius: '8px', fontSize: '14px' }}>
              Error: {errorMessage}
            </div>
          )}

          <button 
            type="submit" 
            disabled={status === 'loading'}
            style={{ width: '100%', padding: '16px', borderRadius: '8px', background: '#0d0d1a', color: '#fff', fontSize: '16px', fontWeight: 600, border: 'none', cursor: status === 'loading' ? 'not-allowed' : 'pointer', marginTop: '10px', opacity: status === 'loading' ? 0.7 : 1 }}
          >
            {status === 'loading' ? 'Submitting...' : 'Register for Founding Access'}
          </button>
        </form>
      </main>

      {/* Footer */}
      <footer style={{ backgroundColor: '#000', color: '#fff', padding: '40px', textAlign: 'center', fontSize: '13px', marginTop: '60px' }}>
        <p>© 2026 Luevora AI. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default FoundingAccess;
