# Find My Photo

An AI-powered photo album creation platform that uses semantic search to help you organize and discover your memories effortlessly.

## Overview

Find My Photo transforms the way you create photo albums by leveraging AI-powered semantic search. Simply describe what you're looking for in natural language, and the AI will automatically find and suggest relevant photos from your collection. No more spending hours scrolling through thousands of photos - create beautiful, organized albums in minutes.

## Core Functionality

### AI-Powered Photo Discovery
- **Semantic Search**: Describe your desired album in natural language (e.g., "beach vacation photos" or "pictures of my dog playing in the park")
- **Smart Suggestions**: AI analyzes your photo collection and suggests the most relevant images based on your description
- **Similarity Scoring**: Each suggested photo includes a match percentage to help you make selections

### Photo Management
- **Multiple Upload Sources**:
  - Upload photos from your device
  - Import photos from Google Photos via official Google Photos Picker API
- **Photo Gallery**: View all your uploaded photos in an organized, responsive gallery
- **Google Photos Integration**: Securely connect your Google Photos account and select photos to import
- **Private & Secure**: Your photos remain private and are only accessible to you

### Album Creation
- **3-Step Workflow**:
  1. **Describe**: Tell the AI what kind of album you want to create
  2. **Review**: Browse AI-suggested photos with similarity scores
  3. **Finalize**: Select photos, add album details, and create your album
- **Manual Control**: Select, deselect, or add photos manually to refine your album
- **Cover Images**: Automatically set cover photos or choose your own

### Dashboard & Organization
- **Statistics Overview**: Track total albums, photos, and favorites
- **Album Management**: Browse, view, and manage all your created albums
- **Quick Actions**: Easy access to upload photos or create new albums
- **User Profiles**: Personalized experience with user avatars and display names

## Tech Stack

### Frontend
- **Next.js 15**: React framework with App Router
- **React 19**: Latest React features
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **shadcn/ui**: High-quality UI components built on Radix UI

### Backend & Database
- **Supabase**: PostgreSQL database, authentication, and storage
- **Supabase Auth**: Secure user authentication and session management
- **Row Level Security**: Database-level security policies

### AI & Processing
- **Semantic Search API**: AI-powered photo analysis and matching
- **n8n Webhooks**: Automation workflows for photo processing and album creation
- **Google Photos Picker API**: Official integration for secure photo import from Google Photos

### UI Components
- Radix UI primitives for accessibility
- Lucide React icons
- React Hook Form with Zod validation
- Sonner for toast notifications
- Date-fns for date formatting

## Project Structure

```
v0-find-my-photo/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                 # Landing page
│   ├── dashboard/               # User dashboard
│   ├── create-album/            # Album creation workflow
│   ├── upload-photos/           # Photo upload interface
│   ├── albums/[id]/             # Individual album view
│   ├── sign-in/                 # Authentication pages
│   └── api/webhooks/            # API routes for n8n integration
├── components/                   # React components
│   ├── ui/                      # shadcn/ui components
│   ├── photo-gallery.tsx        # Photo grid display
│   └── animated-search-input.tsx # Search interface
├── lib/                         # Utility libraries
│   └── supabase/                # Supabase client configuration
└── public/                      # Static assets

```

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Supabase account
- n8n instance (for AI processing workflows)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/v0-find-my-photo.git
cd v0-find-my-photo
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file with the following:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google Photos Integration (Optional)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

**Note:** For Google Photos integration setup, see `GOOGLE_PHOTOS_SETUP.md`

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Database Setup

The application requires the following Supabase tables:
- `profiles`: User profile information (includes Google OAuth tokens)
- `photos`: Uploaded photo metadata and storage references
- `albums`: Album information and photo associations
- `google_photos_sessions`: Tracks Google Photos Picker sessions
- `google_photos_imports`: Stores imported Google Photos metadata

Run migrations in order:
1. `migrations/001_extend_schema_for_multi_user.sql`
2. `migrations/002_add_google_photos_integration.sql`

## Features in Detail

### Landing Page
- Beautiful gradient design with glassmorphic effects
- Feature showcase highlighting AI capabilities
- "How It Works" section explaining the 3-step process
- Responsive design for all device sizes

### Authentication
- Email/password authentication via Supabase
- Protected routes with middleware
- Session management
- Profile creation during onboarding

### Photo Upload
- **Multiple Upload Methods**:
  - Manual file selection from device
  - Google Photos Picker integration
- **Device Upload**:
  - Multi-file selection
  - Image preview before upload
  - Progress tracking
- **Google Photos Import**:
  - OAuth 2.0 secure authentication
  - Browse and select photos from Google Photos library
  - Thumbnail previews
  - Batch import support
- Automatic integration with photo library

### Album Creation Workflow
**Step 1 - Describe Your Album**
- Natural language input for album description
- Quick suggestion chips for common album types
- Optional album title field

**Step 2 - Review AI Suggestions**
- Grid view of AI-suggested photos
- Similarity scores for each photo
- Select/deselect individual photos
- Batch select/deselect all functionality

**Step 3 - Finalize Album**
- Set album title and final details
- Review album summary (photo count, creation date)
- Create and save album to database

### Dashboard
- Welcome message with personalized greeting
- Statistics cards showing albums, photos, and favorites
- Quick action cards for uploading and creating
- Recent albums grid with hover effects
- Complete photo gallery with pagination

## API Routes

### Photo Upload
- **`/api/webhooks/photos-upload`**: Handles photo file uploads from device
- Processes images for semantic search
- Stores metadata in Supabase

### Album Management
- **`/api/webhooks/album-create-request`**: Sends album description to AI service
- **`/api/webhooks/album-finalized`**: Creates album and associates photos

### Google Photos Integration
- **`/api/auth/google/callback`**: OAuth 2.0 callback handler
- **`/api/google-photos/create-session`**: Creates Google Photos Picker session
- **`/api/google-photos/poll-session/[sessionId]`**: Polls session status
- **`/api/google-photos/media-items`**: Retrieves selected photos

For detailed Google Photos integration documentation, see `GOOGLE_PHOTOS_IMPLEMENTATION.md`

## Development Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Deployment

This project is optimized for deployment on Vercel:

1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to main branch


## Key Design Patterns

- **Server Components**: Utilized for data fetching and authentication checks
- **Client Components**: Used for interactive UI elements and forms
- **Progressive Enhancement**: Works without JavaScript for basic functionality
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints
- **Optimistic Updates**: Immediate UI feedback before server confirmation

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is private and proprietary.

## Acknowledgments

- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)
- Google Photos integration via [Google Photos Picker API](https://developers.google.com/photos/picker)

## Additional Documentation

- **`GOOGLE_PHOTOS_SETUP.md`**: Step-by-step setup guide for Google Cloud Console and OAuth configuration
- **`GOOGLE_PHOTOS_IMPLEMENTATION.md`**: Complete technical documentation of the Google Photos integration

---

© 2025 Find My Photo. All rights reserved.
