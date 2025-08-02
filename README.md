# CivicTrack - Local Issue Reporting Platform

CivicTrack is a web application that empowers citizens to easily report local issues such as road damage, garbage, water leaks, and other civic problems. Users can track the resolution of these issues and engage with their local community.

## Features

### 🔍 **Visibility & Location-Based Filtering**
- Only civic issues within a 3-5 km radius are visible to users
- GPS-based location detection or manual pin-drop
- Users cannot browse reports outside their neighborhood zone

### 📱 **Quick Issue Reporting**
- Report issues with title, description, and photos (up to 5)
- Anonymous or verified reporting options
- Category selection for better organization

### 🏷️ **Supported Issue Categories**
- **Roads**: Potholes, obstructions
- **Lighting**: Broken or flickering lights
- **Water Supply**: Leaks, low pressure
- **Cleanliness**: Overflowing bins, garbage
- **Public Safety**: Open manholes, exposed wiring
- **Obstructions**: Fallen trees, debris

### 📊 **Status Tracking**
- Real-time status updates (Reported, In Progress, Resolved)
- Activity logs with timestamps for transparency
- Email notifications when issue status changes

### 🗺️ **Map Mode & Filtering**
- Interactive map view showing all issues as pins
- Filter by status, category, and distance
- Distance-based filtering (1km, 3km, 5km)

### 🛡️ **Moderation & Safety**
- Spam reporting system
- Auto-hide issues flagged by multiple users
- Admin review system for flagged content

### 👨‍💼 **Admin Features**
- Review and manage reported issues
- Access analytics and reports
- User management and moderation tools

## Technology Stack

- **Frontend**: HTML5, Tailwind CSS, Vanilla JavaScript
- **Maps**: OpenStreetMap with Leaflet.js
- **Geocoding**: Nominatim API

## Setup Instructions

1. **Clone or Download the Project**
   ```bash
   git clone <repository-url>
   cd civictrack
   ```

2. **Run the Application**
   - Open `index.html` in a web browser
   - Or serve it using a local server:
     ```bash
     # Using Python
     python -m http.server 8000
     
     # Using Node.js
     npx serve .
     
     # Using PHP
     php -S localhost:8000
     ```

## Usage Guide

### For Citizens

1. **Browse Issues**
   - View issues in your area without logging in
   - Use filters to find specific types of issues
   - Switch to map view for geographical overview

2. **Report an Issue**
   - Click "Report New Issue" (requires login)
   - Upload photos (up to 5)
   - Select location on map or use GPS
   - Choose category and add description
   - Submit anonymously or with your account

3. **Track Issues**
   - View detailed information about any issue
   - See activity logs and status updates
   - Get notified when your reported issues are updated

### For Administrators

1. **Access Admin Panel**
   - Login with admin credentials
   - Access moderation tools and analytics

2. **Manage Issues**
   - Review flagged/spam reports
   - Update issue status
   - Delete inappropriate content

3. **View Analytics**
   - Total issues by category
   - Most reported problem types
   - User activity statistics

## Security Features

- **Authentication**: Secure user authentication system
- **File Upload Security**: Restricted file types and sizes
- **Spam Protection**: Multi-user reporting system
- **Location Privacy**: Only shows issues within user's area

## Browser Compatibility

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Mobile Responsiveness

The application is fully responsive and works on:
- Mobile phones
- Tablets
- Desktop computers

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

