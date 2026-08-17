# A'erkt - Digital Restaurant Menu System

A modern, production-grade digital menu system for restaurants. Built with Next.js 15+, TypeScript, Tailwind CSS, and designed for both customer-facing browsing and admin management.

## 🎯 Features

### Customer Menu
- **Multilingual Support**: English and Amharic language support
- **Search & Filter**: Real-time search across menu items
- **Category Navigation**: Sticky, horizontally-scrollable categories
- **Favorites System**: Save favorite items locally
- **Recently Viewed**: Track recently viewed items
- **Dark Mode**: Beautiful dark mode support
- **Responsive Design**: Fully optimized for mobile, tablet, and desktop
- **Food Cards**: Beautiful menu item cards with pricing and indicators
- **Item Details**: Modal-based item details with full information
- **Dietary Indicators**: Vegetarian, Fasting, and Spicy badges

### Admin Dashboard
- **Menu Management**: Full CRUD operations for menu items
- **Category Management**: Create and organize categories
- **Availability Toggle**: Mark items as available/sold out
- **Settings**: Configure restaurant details and social links
- **QR Code Generator**: Generate QR codes for table placement
- **Analytics Dashboard**: View menu statistics and popular items
- **Admin Authentication**: Protected admin area

### Technical Features
- **JSON-Based Data Layer**: Repository pattern for easy database migration
- **TypeScript**: Full type safety throughout the application
- **Tailwind CSS**: Beautiful, responsive design system
- **Zod Validation**: Schema validation for all data
- **Server Components**: Optimized for performance
- **PWA Ready**: Can be installed as a web app

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ or higher
- npm, yarn, or pnpm

### Installation

1. **Clone/Setup the project**
```bash
cd arikt
```

2. **Install dependencies**
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. **Environment Setup** (Optional for admin area)
Create a `.env.local` file (optional):
```env
NEXT_PUBLIC_ADMIN_EMAIL=admin@A'erkt.com
NEXT_PUBLIC_ADMIN_PASSWORD=admin123
```

4. **Run the development server**
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

5. **Open your browser**
Navigate to `http://localhost:3000`

## 📋 Using the System

### Customer Menu (Public)
- Visit `/menu` to browse the restaurant menu
- Use the search bar to find items
- Click category tabs to filter by category
- Click an item card to see details
- Save items to favorites using the heart icon
- Switch between English and Amharic using the language selector
- Toggle dark mode with the moon/sun icon

### Admin Dashboard
- Visit `/admin/login` to access the admin panel
- **Default Demo Credentials:**
  - Email: `admin@A'erkt.com`
  - Password: `admin123`

#### Admin Pages:

**Dashboard (`/admin`)**
- View menu statistics
- See featured and recent items
- Quick overview of availability

**Menu Items (`/admin/menu`)**
- View all menu items in a table format
- Toggle item availability
- Edit item details (Edit button ready for implementation)
- Delete items
- Filter by category or availability
- Add new items (Add button ready for implementation)

**Categories (`/admin/categories`)**
- Manage menu categories
- View category details
- Edit and delete categories
- Add new categories

**QR Code (`/admin/qr-code`)**
- Generate QR codes pointing to the menu
- Support for table-specific QR codes
- Download as PNG
- Print QR codes
- Copy menu URL to clipboard

**Settings (`/admin/settings`)**
- Edit restaurant name and information
- Configure contact details
- Set currency
- Add social media links
- Update business address
- Configure opening hours

## 📁 Project Structure

```
app/
├── layout.tsx                 # Root layout with global styles
├── globals.css               # Global CSS and tailwind imports
├── page.tsx                  # Homepage
└── menu/
    └── page.tsx              # Customer menu page
└── admin/
    ├── login/
    │   └── page.tsx          # Admin login page
    ├── page.tsx              # Admin dashboard
    ├── menu/
    │   └── page.tsx          # Menu management
    ├── categories/
    │   └── page.tsx          # Category management
    ├── qr-code/
    │   └── page.tsx          # QR code generator
    └── settings/
        └── page.tsx          # Restaurant settings

components/
├── menu/
│   ├── FoodCard.tsx          # Menu item card component
│   ├── SearchBar.tsx         # Search functionality
│   ├── CategoryNav.tsx       # Category navigation
│   └── MenuHeader.tsx        # Menu page header
└── admin/
    └── AdminLayout.tsx       # Admin sidebar and layout

data/
├── menu.json                 # Menu items database
├── categories.json           # Categories database
└── restaurant.json           # Restaurant settings

lib/
├── types.ts                  # TypeScript type definitions
├── admin-auth.ts             # Admin authentication utilities
├── menu/
│   └── repository.ts         # Data access layer
├── validation/
│   └── schemas.ts            # Zod validation schemas
└── utils/
    └── common.ts             # Utility functions

public/
└── images/
    └── menu/                 # Menu item images (future)
```

## 🗂️ Data Architecture

### Menu Data (`data/menu.json`)
```json
[
  {
    "id": "porridge-avocado",
    "categoryId": "breakfast",
    "name": {
      "en": "Porridge Avocado",
      "am": "..."
    },
    "description": {
      "en": "Oats, milk, boiled egg, honey served with bread",
      "am": "..."
    },
    "price": 250,
    "currency": "ETB",
    "image": null,
    "available": true,
    "featured": false,
    "fasting": false,
    "vegetarian": true,
    "spicy": false,
    "displayOrder": 1
  }
]
```

### Categories (`data/categories.json`)
```json
[
  {
    "id": "breakfast",
    "name": { "en": "Breakfast", "am": "ቁርስ" },
    "icon": "Coffee",
    "displayOrder": 1,
    "visible": true
  }
]
```

### Restaurant Settings (`data/restaurant.json`)
```json
{
  "id": "default",
  "name": { "en": "A'erkt", "am": "ዐርክ" },
  "phone": "+251-11-123-4567",
  "address": { "en": "Addis Ababa, Ethiopia", "am": "..." },
  "currency": "ETB",
  "defaultLanguage": "en",
  "availableLanguages": ["en", "am"],
  "social": { "instagram": "...", "facebook": "..." }
}
```

## 🔧 Repository Pattern (Data Abstraction Layer)

The system uses a repository pattern in `lib/menu/repository.ts` to abstract data access. This allows easy migration from JSON to a database later.

### Current: JSON Repository
```typescript
// All read/write operations go through the repository
const items = await repository.getMenuItems();
const item = await repository.getMenuItem('id');
await repository.createMenuItem(data);
await repository.updateMenuItem('id', data);
```

### Future: Database Repository
Simply replace the repository implementation with a database-backed one:
```typescript
// Supabase, PostgreSQL, MongoDB, etc.
// No UI changes required!
```

## 🎨 Design System

The application uses a premium Ethiopian restaurant aesthetic:

- **Primary Colors**:
  - Accent: Gold (`#a89958`)
  - Background: Cream (`#f5f1e8`)
  - Text: Dark Brown (`#3d3220`)

- **Typography**:
  - Headings: Serif font (Lora)
  - Body: Sans-serif (Inter)

- **Components**:
  - Cards with subtle shadows
  - Smooth transitions and animations
  - Responsive grid layouts
  - Touch-friendly mobile interactions

## 🔐 Authentication & Security

### Admin Area
- Simple session-based authentication using localStorage
- Environment-based credentials (can be replaced with real auth service)
- Protected routes using `withAdminAuth` HOC

### Future Integration
The authentication layer is designed to be replaceable with:
- Auth.js / NextAuth.js
- Supabase Auth
- Firebase Auth
- Custom authentication service

## 📱 Mobile Optimization

- **Viewport**: Optimized for 320px-1440px screen widths
- **Touch Targets**: 44px minimum touch targets for buttons
- **Sticky Navigation**: Category filters remain accessible
- **Readable Text**: No text smaller than 16px on mobile
- **Safe Area**: Respects phone notches and safe areas
- **Performance**: Fast loading on slow networks
- **Dark Mode**: Easy on the eyes in low light

## 🚀 Deployment

### Local Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm run start
```

### Deployment Options

**Vercel (Recommended)**
```bash
npm install -g vercel
vercel
```

**Other Platforms**
- Netlify
- AWS Amplify
- Railway
- Render
- Digital Ocean

## ⚠️ Important Notes

### JSON Storage
- **Local Development**: JSON files work perfectly for development and small deployments
- **Serverless Platforms** (Vercel, Netlify): JSON files are read-only. Use Supabase/PostgreSQL for persistent storage
- **Self-Hosted**: JSON files can be made persistent with proper setup

### Transitioning to Database
When ready to use a real database:

1. Create a new repository implementation (`lib/menu/supabase-repository.ts`)
2. Implement the `IRepository` interface
3. Replace the export in `lib/menu/repository.ts`
4. No UI changes required!

## 🔄 Local JSON Persistence (Development)

For local development where you want to persist changes to JSON:

1. The app currently reads from static JSON files
2. To add write capability for development, implement API routes:
   ```typescript
   // app/api/menu/items/route.ts
   // app/api/menu/items/[id]/route.ts
   // etc.
   ```
3. Connect these API routes to the repository layer

## 📊 Analytics & Tracking

Currently tracking locally:
- Recently viewed items
- Favorites (localStorage)
- Page views (via browser history)

Future enhancements:
- Server-side analytics
- User behavior tracking
- Popular item tracking
- Peak traffic times

## 🐛 Troubleshooting

**Menu items not showing**
- Verify `data/menu.json` has valid JSON
- Check browser console for errors
- Clear localStorage: `localStorage.clear()`

**Admin login not working**
- Check credentials in `.env.local` or use defaults
- Clear admin auth: `localStorage.removeItem('admin_token')`
- Check browser localStorage is enabled

**Styles not loading**
- Clear `.next` cache: `rm -rf .next`
- Rebuild: `npm run build`
- Check Tailwind configuration in `tailwind.config.ts`

**Dark mode not working**
- Ensure `html` element has `dark` class
- Check theme preference is saved in localStorage
- Clear theme storage: `localStorage.removeItem('menu_theme')`

## 🔮 Future Enhancements

- [ ] Real database integration (Supabase/PostgreSQL)
- [ ] Payment processing
- [ ] Online ordering system
- [ ] Table-based ordering
- [ ] Kitchen management system
- [ ] Customer feedback/ratings
- [ ] Analytics dashboard
- [ ] Image upload for menu items
- [ ] Multi-location support
- [ ] Email notifications
- [ ] WhatsApp integration
- [ ] Inventory management
- [ ] Staff management

## 📄 License

This project is provided as-is for restaurant management purposes.

## 🤝 Support

For questions or issues:
1. Check the troubleshooting section
2. Review the project structure
3. Check browser console for errors
4. Verify JSON data is valid

## 📞 Restaurant Contact

- **Name**: A'erkt
- **Email**: info@A'erkt.com
- **Phone**: +251-11-123-4567
- **Address**: Addis Ababa, Ethiopia

---

**Built with ❤️ for restaurants**
