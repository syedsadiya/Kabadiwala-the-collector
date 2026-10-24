export default function PickupSuccess() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '24px',
        boxSizing: 'border-box',
        background: '#f0fdf4',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '32px 24px',
          background: '#ffffff',
          borderRadius: '20px',
          textAlign: 'center',
          boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ fontSize: '64px' }}>✅</div>

        <h1 style={{ color: '#166534' }}>
          Pickup Completed Successfully!
        </h1>

        <p style={{ fontSize: '18px', lineHeight: 1.6 }}>
          Thank you for recycling with Kabadiwala Connect!
        </p>

        <p style={{ color: '#15803d', lineHeight: 1.6 }}>
          Together, let's build a cleaner and greener world. 🌱♻️
        </p>
      </section>
    </main>
  );
}