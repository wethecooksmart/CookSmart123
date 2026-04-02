const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://ketanagarwal123:Ketan@123@cluster0.3qmj8.mongodb.net/cooksmart?retryWrites=true&w=majority');
    
    const users = await User.find().select('email name createdAt');
    
    console.log('\n=== MONGODB USERS ===\n');
    console.log(`Total Users: ${users.length}\n`);
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email}`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Created: ${user.createdAt}`);
      console.log('');
    });
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkUsers();
