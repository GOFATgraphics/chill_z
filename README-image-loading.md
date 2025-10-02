# Image Loading & Demo Mode Configuration

## SafeImage Component

The `SafeImage` component provides robust image loading with retry logic, fallbacks, and demo mode support.

### Why Not Proxy External Images Through Supabase

- **Performance**: Direct URLs to image providers (Clearbit, DiceBear, Unsplash) are faster
- **Cost**: Avoids Supabase bandwidth costs for public images
- **Reliability**: Multiple fallback providers ensure images always load
- **Caching**: External CDNs handle caching better than proxying through Supabase

### Only Use Supabase For:
- User-uploaded images (private content)
- Generate signed URLs server-side for user uploads
- Cache signed URLs in browser with CDN in front of Supabase

## Demo Mode Configuration

### Enable Low Bandwidth Demo Mode:

1. **Environment Variable** (recommended for production):
   ```bash
   VITE_DEMO_LOW_BANDWIDTH=true
   ```

2. **Local Storage** (for quick testing):
   ```javascript
   localStorage.setItem('demo_low_bandwidth', 'true');
   ```

### Demo Mode Behavior:
- Only loads first 3 feed images
- Shows placeholders for remaining images
- Limits concurrent image downloads to 3
- Reduces bandwidth usage during demos

## Adding Brand Logo Fallbacks

To add new brand logos, create fallback files in `/src/assets/logos/`:

### File Naming Convention:
- Primary: `local-{domain-without-extension}.png`
- Examples:
  - `local-spotify.png` (for spotify.com)
  - `local-google.png` (for google.com)
  - `local-microsoft.png` (for microsoft.com)

### Fallback Chain:
1. Clearbit: `https://logo.clearbit.com/{domain}`
2. Local fallback: `/assets/logos/local-{brand}.png`
3. Default logo: `/assets/logos/default.png`

### Example Usage:
```tsx
<SafeImage
  src="https://logo.clearbit.com/newbrand.com"
  alt="New Brand"
  className="w-10 h-10"
  width={40}
  height={40}
/>
```

## Image Providers Used

### Avatars:
- **Primary**: DiceBear Avatars (`https://api.dicebear.com/7.x/avataaars/svg?seed={username}`)
- **Fallback**: Pravatar (`https://i.pravatar.cc/150?u={username}`)

### Content Images:
- **Primary**: Unsplash (`https://source.unsplash.com/800x600/?{topic}`)
- **Fallback**: Picsum (`https://picsum.photos/800/600?random={seed}`)

### Brand Logos:
- **Primary**: Clearbit (`https://logo.clearbit.com/{domain}`)
- **Fallback**: Local assets

## Performance Features

- **Lazy Loading**: Images load when entering viewport
- **Concurrency Limiting**: Max 4 parallel image downloads
- **Retry Logic**: Exponential backoff with max 3 attempts
- **Throttling**: Randomized delays prevent thundering herd
- **Error Handling**: Graceful fallbacks for CORS/rate limiting

## Security Notes

- All external sources use HTTPS
- CORS-safe HEAD requests where supported
- No sensitive data exposed through image URLs
- Rate limit respect with randomized delays