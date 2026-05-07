/** @jsxImportSource hono/jsx */

export const InquiryReceipt = ({ name, type, id }: { name: string; type: string; id: string }) => {
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  const date = new Date().toLocaleDateString();

  return (
    <div style={{
      fontFamily: 'sans-serif',
      color: '#ffffff',
      backgroundColor: '#09090b',
      padding: '40px',
      borderRadius: '16px',
      maxWidth: '600px',
      margin: '0 auto',
      border: '1px solid #27272a'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ 
          color: '#eab308', 
          fontSize: '24px', 
          fontWeight: '900', 
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          margin: '0'
        }}>
          ARES 23247
        </h1>
        <p style={{ color: '#a1a1aa', fontSize: '14px', marginTop: '8px' }}>
          Mountaineer Mindset. Engineered to Inspire.
        </p>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>
          Hi {name},
        </h2>
        <p style={{ color: '#d4d4d8', lineHeight: '1.6' }}>
          Thank you for reaching out to ARES 23247! We&apos;ve received your <strong>{typeLabel}</strong> inquiry and our team will review it shortly.
        </p>
      </div>

      <div style={{ 
        backgroundColor: '#000000', 
        padding: '24px', 
        borderRadius: '12px', 
        border: '1px solid #27272a',
        marginBottom: '32px'
      }}>
        <table style={{ width: '100%', fontSize: '14px' }}>
          <tr>
            <td style={{ color: '#71717a', paddingBottom: '12px' }}>REFERENCE ID</td>
            <td style={{ textAlign: 'right', fontWeight: 'bold', paddingBottom: '12px' }}>{id.slice(0, 8)}</td>
          </tr>
          <tr>
            <td style={{ color: '#71717a', paddingBottom: '12px' }}>DATE</td>
            <td style={{ textAlign: 'right', fontWeight: 'bold', paddingBottom: '12px' }}>{date}</td>
          </tr>
          <tr>
            <td style={{ color: '#71717a' }}>STATUS</td>
            <td style={{ textAlign: 'right', color: '#eab308', fontWeight: 'bold' }}>RECEIVED</td>
          </tr>
        </table>
      </div>

      <div style={{ textAlign: 'center', color: '#71717a', fontSize: '12px' }}>
        <p>
          Need to add more details? Reply to this email or join us on Zulip.
        </p>
        <p style={{ marginTop: '16px' }}>
          © {new Date().getFullYear()} ARES Robotics. Morgantown, WV.
        </p>
      </div>
    </div>
  );
};
