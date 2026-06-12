async function testSessionManagement() {
  const url = 'http://localhost:3002/auth/login';
  
  // Login first time
  console.log('Logging in Device 1...');
  const res1 = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@thryvtechlabs.com', password: 'password1234' })
  });
  const data1 = await res1.json();
  const token1 = data1.data.tokens.accessToken;
  console.log('Token 1 received.');

  // Login second time
  console.log('\nLogging in Device 2...');
  const res2 = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@thryvtechlabs.com', password: 'password1234' })
  });
  const data2 = await res2.json();
  const token2 = data2.data.tokens.accessToken;
  console.log('Token 2 received.');

  // Try to use token 1
  console.log('\nTrying API with Token 1 (should fail)...');
  const apiRes1 = await fetch('http://localhost:3002/users/me', {
    headers: { Authorization: `Bearer ${token1}` }
  });
  console.log('Token 1 Response Status:', apiRes1.status);
  console.log('Token 1 Response Data:', await apiRes1.json());

  // Try to use token 2
  console.log('\nTrying API with Token 2 (should succeed)...');
  const apiRes2 = await fetch('http://localhost:3002/users/me', {
    headers: { Authorization: `Bearer ${token2}` }
  });
  console.log('Token 2 Response Status:', apiRes2.status);
  console.log('Token 2 Response Data:', await apiRes2.json());
}

testSessionManagement().catch(console.error);
