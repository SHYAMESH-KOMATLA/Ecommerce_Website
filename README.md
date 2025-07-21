# E-Commerce Website (Mini Project)

This project is a simple, database-driven e-commerce website that allows users to browse products, 
register or log in, add items to their cart, and place orders. It is built using Node.js and MySQL for the backend and HTML, CSS, and JavaScript for the frontend.

## 💡 Project Overview

The goal of this project was to create a functional and user-friendly e-commerce site as a part of my learning in full stack web development.
I implemented features typically found in real-world e-commerce platforms, including:

- User registration and login
- Product catalog with categories
- Shopping cart functionality
- Checkout process with order storage
- Admin dashboard for managing products (optional)
- 
## 🛠️ Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express.js
- **Database**: MySQL
- **Tools**: Git, GitHub, XAMPP (MySQL server)
- 
## 📁 Folder Structure

mini-project/
├── frontend/ # All HTML, CSS, JS files and images
│ ├── index.html
│ ├── styles/
│ └── images/
├── server.js # Main backend file (Node.js)
├── db/ # SQL scripts or DB config
├── .env # Environment variables (not pushed)
├── package.json
└── README.md

## 🚀 How to Run Locally

1. **Clone the repository**
   git clone https://github.com/SHYAMESH-KOMATLA/Ecommerce_Website.git
   cd Ecommerce_Website
2. **Install Node.js dependencies**
npm install
3. **Set up MySQL database**
Create a new database using phpMyAdmin or MySQL CLI.
Import the provided .sql file (if available).
Create a .env file in the root directory:
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=ecommerce_db
4. **Start the server**
node server.js
5. **View the website**
Open frontend/index.html directly in a browser
Or access via backend server at: http://localhost:3000
## 📸 Key Features
> Mobile-friendly UI and product filtering
> User session management
> Secure login & registration
> Dynamic product rendering from MySQL
> Order history saved per user
> Optional admin panel
## 📬 Contact
If you'd like to know more about this project or collaborate:
GitHub: @SHYAMESH-KOMATLA
Email: shyameshkomatla@example.com

