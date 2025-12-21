async function testLoginProxy() {
    console.log('Testing login via PROXY (port 3000)...');
    try {
        const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'admin@ihalerobotum.com',
                password: 'admin'
            })
        });

        const data = await response.json().catch(e => ({ error: 'Invalid JSON', text: response.statusText }));
        console.log('Status:', response.status);
        console.log('Response:', data);

        if (response.status === 200) {
            console.log('SUCCESS: Proxy is working!');
        } else {
            console.log('FAILURE: Proxy failed.');
            if (response.status === 404) {
                console.log('Reason: 404 Not Found. Rewrite rule probably not active. RESTART NEXT.JS SERVER.');
            }
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testLoginProxy();
