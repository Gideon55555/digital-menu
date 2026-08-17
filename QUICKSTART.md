# Quick Start Guide

## 🚀 Getting Running in 5 Minutes

### 1. Install Dependencies
```bash
cd c:\Users\User\Desktop\arikt
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Open in Browser
- **Customer Menu**: http://localhost:3000/menu
- **Admin Login**: http://localhost:3000/admin/login
- **Homepage**: http://localhost:3000

---

## 📱 Customer Menu Features

### View Menu
1. Go to http://localhost:3000/menu
2. Browse menu items by category
3. Search for specific dishes
4. Click items to see details
5. Save favorites (❤️ icon)
6. Switch languages (EN | አማ)
7. Toggle dark mode (🌙)

### Menu Content
- **Breakfast**: 13 items
- **Lunch/Dinner**: 11 items + 1 special combo
- **Fasting**: 6 items + special combo
- **All items**: Full English descriptions, prices, and dietary info

---

## 🔐 Admin Dashboard

### Login
- **URL**: http://localhost:3000/admin/login
- **Email**: admin@A'erkt.com
- **Password**: admin123

### Dashboard Pages

**Dashboard** (`/admin`)
- View quick statistics
- See featured items
- Monitor inventory

**Menu Items** (`/admin/menu`)
- View all items in table format
- Toggle availability (👁️ icons)
- Search and filter by category
- Add new items (button ready)
- Edit items (button ready)
- Delete items (with confirmation)

**Categories** (`/admin/categories`)
- View all categories
- Add new category (button ready)
- Edit categories (button ready)
- Delete categories

**QR Code** (`/admin/qr-code`)
- Generate QR codes for customers
- Copy menu URL
- Download QR as PNG
- Print QR codes
- Support for table-specific QR codes

**Settings** (`/admin/settings`)
- Restaurant name & info
- Contact details (phone, email)
- Address and maps link
- Currency setting
- Social media links
- Save all changes

---

## 🛠️ Customization Quick Tips

### Change Restaurant Name
Edit `data/restaurant.json`:
```json
{
  "name": {
    "en": "Your Restaurant Name",
    "am": "ሌላ ሱም"
  }
}
```

### Add Menu Item
Edit `data/menu.json`:
```json
{
  "id": "unique-id",
  "categoryId": "breakfast",
  "name": {
    "en": "Dish Name",
    "am": "ሕብረት ስም"
  },
  "description": {
    "en": "Description here",
    "am": ""
  },
  "price": 250,
  "currency": "ETB",
  "available": true,
  "vegetarian": false,
  "spicy": true,
  "fasting": false,
  "displayOrder": 14
}
```

### Add Category
Edit `data/categories.json`:
```json
{
  "id": "desserts",
  "name": {
    "en": "Desserts",
    "am": "ጣፋጭ ምግብ"
  },
  "icon": "Cake",
  "displayOrder": 5,
  "visible": true
}
```

---

## 🎨 Design Customization

### Colors (in `tailwind.config.ts`)
- Gold Accent: `#a89958`
- Cream Background: `#f5f1e8`
- Dark Text: `#3d3220`

### Typography
- Headings: Serif font
- Body: Sans-serif

### Layout Changes
Most styling is in:
- `app/globals.css` - Global styles
- `tailwind.config.ts` - Theme configuration
- Component className attributes

---

## 📊 Data Files Reference

### Menu Items (`data/menu.json`)
- 31 items total
- 4 categories
- Price, availability, dietary info
- English + Amharic support
- Display order for sorting

### Categories (`data/categories.json`)
- 4 categories
- Icons for visual identification
- Visibility toggle
- Display order

### Restaurant Settings (`data/restaurant.json`)
- Name, address, contact
- Opening hours
- Social media links
- Currency
- Language preferences

---

## 🔄 Data Flow

```
User Action
    ↓
Component (FoodCard, SearchBar, etc.)
    ↓
Repository (lib/menu/repository.ts)
    ↓
JSON Data (data/*.json)
    ↓
Display on Screen
```

**Key Benefit**: To switch to database, just replace repository implementation. No UI changes needed!

---

## 📱 Testing Mobile

### Chrome DevTools
1. Press F12
2. Click device toolbar (📱 icon)
3. Select device (iPhone, Pixel, etc.)
4. Test responsiveness

### Common Breakpoints
- Mobile: 320px - 640px
- Tablet: 641px - 1024px
- Desktop: 1025px+

---

## 🔍 Troubleshooting

**Port 3000 already in use?**
```bash
npm run dev -- -p 3001
```

**Styles not loading?**
```bash
rm -rf .next
npm run dev
```

**Can't login to admin?**
```bash
localStorage.clear()
```
Then refresh and try again with:
- Email: admin@A'erkt.com
- Password: admin123

**JSON not updating?**
JSON reads from disk each time. Changes appear after:
- Saving file
- Restarting dev server
- Page refresh

---

## 📚 Next Steps

1. **Customize Content**
   - Edit menu items in `data/menu.json`
   - Add your restaurant info to `data/restaurant.json`

2. **Add Images**
   - Place images in `public/images/menu/`
   - Update `image` field in menu items

3. **Deploy**
   - Use Vercel for free deployment
   - Add Supabase for persistent storage
   - Set environment variables in deployment

4. **Extend Features**
   - Add ordering system
   - Integrate payments
   - Build kitchen display
   - Add analytics

---

## 🚨 Production Considerations

**Before Going Live:**
- [ ] Update restaurant details
- [ ] Add real menu images
- [ ] Configure admin credentials (use env vars)
- [ ] Test on real mobile devices
- [ ] Plan database migration if needed
- [ ] Set up analytics
- [ ] Configure social media links
- [ ] Test QR codes
- [ ] Set up domain/SSL

**Storage Notes:**
- **Local/Self-hosted**: JSON works fine
- **Vercel/Netlify**: Use Supabase for storage
- **Scale**: Migrate to PostgreSQL with the repository pattern

---

**Start building! 🚀**
