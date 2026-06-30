const data = {
    customerData: {
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
        address1: '123 Test St',
        city: 'Test City',
        province: 'Tamil Nadu',
        zip: '12345',
        phone: '1234567890'
    },
    cartItems: [{ variant_id: 123456, quantity: 1 }]
};

fetch('http://localhost:3000/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
})
.then(r => r.json())
.then(console.log)
.catch(console.error);

//
