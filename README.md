# GlucoPlate 🥗

A budget-aware, sugar-safe meal planning application specifically designed for people with diabetes.

## 🌟 Overview

GlucoPlate helps users manage their nutrition and budget simultaneously. It uses a specialized allocation algorithm to generate meal plans that prioritize low Glycemic Index (GI) foods while staying within a daily financial budget.

## 🚀 Architecture

The project uses a **Headless Architecture**:
- **Frontend**: Native mobile app built with **Expo**, **Expo Router**, and **NativeWind** (Tailwind CSS).
- **Backend**: **Next.js API** serving as the headless backend.
- **Database**: **PostgreSQL** with **Drizzle ORM**.

## ✨ Key Features

- **Smart Meal Planner**: Generates daily plans prioritizing Lowest GI $\\rightarrow$ Lowest Cost $\\rightarrow$ Lowest Carbs.
- **Bucket List**: Manage a personal collection of diabetic-friendly dishes.
- **Health Hub**: Track weight and receive AI-powered nutritional support.
- **Budget Tracking**: Real-time monitoring of meal spending versus daily limits.
- **Analytics**: Visual trends of carb intake and meal quality.

## 🛠️ Getting Started

### Prerequisites
- Node.js (Latest LTS)
- Expo Go app installed on your mobile device

### Installation

1. Clone the repository:
   \`\`\`bash
   git clone https://github.com/YOUR_USERNAME/diabetic-meal-planner-app.git
   cd diabetic-meal-planner-app
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Start the development server:
   \`\`\`bash
   npx expo start --tunnel
   \`\`\`

4. Scan the QR code with your **Expo Go** app.

## 📂 Project Structure

- \`app/\`: Expo Router pages and layouts (Mobile Frontend).
- \`src/lib/\`: Shared business logic and API clients.
- \`src/db/\`: Database schemas and Drizzle configuration.

## ⚖️ Medical Disclaimer

*GlucoPlate is a planning aid and not a substitute for professional medical advice. Always coordinate your carb targets and meal plans with your healthcare provider.*
