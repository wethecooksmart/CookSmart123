// test-login.js - Simple login test
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');

async function testLogin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ MongoDB connected');

    // Find a user to test
    const users = await User.find().limit(1);
    
    if (users.length === 0) {
      console.log('❌ No users in database. Create a user first by signing up.');
      await mongoose.connection.close();
      return;
    }

    const testUser = users[0];
    console.log('\n📧 Test User Email:', testUser.email);
    console.log('👤 Test User Name:', testUser.name);

    // Test password matching
    const testPassword = 'password123'; // Try common password
    const isMatch = await testUser.matchPassword(testPassword);
    
    if (isMatch) {
      console.log('✅ Password match: The password "password123" is correct!');
    } else {
      console.log('❌ Password match failed for "password123"');
      console.log('   Try the password you used when signing up.');
    }

    console.log('\n💡 To test login:');
    console.log(`   Email: ${testUser.email}`);
    console.log('   Password: (the password you set during signup)');

    await mongoose.connection.close();
    console.log('\n✅ Test complete');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

testLogin();
