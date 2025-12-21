async function testLoginSpaces() {
    console.log('Testing login with spaces...');
    try {
        const response = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: '  admin@ihalerobotum.com  ', // Spaces added
                password: 'admin'
            })
        });

        const data = await response.json();
        console.log('Status:', response.status);
        if (response.status === 200) {
            console.log('SUCCESS: Login with spaces worked!');
        } else {
            console.log('FAILURE: Login with spaces failed.');
        }
        console.log('Response:', data);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testLoginSpaces();
