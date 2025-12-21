const axios = require('axios');

async function testLogin() {
    try {
        const res = await axios.post('http://localhost:3001/api/auth/login', {
            email: 'admin@ihalerobotum.com',
            password: 'admin'
        });
        console.log('Login successful!');
        console.log('User:', res.data.user);
        console.log('Token received:', !!res.data.token);
    } catch (error) {
        console.error('Login failed:', error.response ? error.response.data : error.message);
    }
}

testLogin();
