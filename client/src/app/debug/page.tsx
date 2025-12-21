export default function DebugPage() {
    return (
        <div style={{ padding: 50, fontFamily: 'sans-serif' }}>
            <h1>Debug Page</h1>
            <p>If you can see this, the Vercel deployment is rendering pages correctly.</p>
            <p>Time: {new Date().toISOString()}</p>
        </div>
    );
}
