import { useState } from 'react';
import './Avatar.css';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: AvatarSize;
  className?: string;
}

// Generate a simple identicon based on name hash
function generateIdenticon(name: string): string {
  const hash = name.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  
  const colors = [
    '#646cff', '#48bb78', '#ed8936', '#e53e3e', 
    '#4299e1', '#9f7aea', '#38b2ac', '#f56565'
  ];
  
  const color = colors[Math.abs(hash) % colors.length];
  
  // Create a simple 5x5 grid pattern
  const size = 5;
  const cells: boolean[] = [];
  
  for (let i = 0; i < size * size; i++) {
    cells.push((hash >> i) % 2 === 0);
  }
  
  const cellSize = 20;
  const svgSize = size * cellSize;
  
  const rects = cells
    .map((filled, i) => {
      if (!filled) return '';
      const x = (i % size) * cellSize;
      const y = Math.floor(i / size) * cellSize;
      return `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${color}"/>`;
    })
    .join('');
  
  const svg = `<svg width="${svgSize}" height="${svgSize}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// Get initials from name
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  src,
  alt,
  name = '',
  size = 'md',
  className = '',
}: AvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const classes = [
    'avatar',
    `avatar-${size}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');
  
  const displayName = alt || name;
  const initials = name ? getInitials(name) : '';
  
  // Determine what to show
  const showImage = src && !imageError;
  const showInitials = !showImage && initials;
  const showIdenticon = !showImage && !showInitials && name;
  
  const handleImageError = () => {
    setImageError(true);
  };
  
  const handleImageLoad = () => {
    setImageLoaded(true);
  };
  
  return (
    <div className={classes} role="img" aria-label={displayName || 'Avatar'}>
      {showImage && (
        <img
          src={src}
          alt={displayName}
          className={`avatar-image ${imageLoaded ? 'avatar-image-loaded' : ''}`}
          onError={handleImageError}
          onLoad={handleImageLoad}
        />
      )}
      
      {showInitials && (
        <span className="avatar-initials">{initials}</span>
      )}
      
      {showIdenticon && (
        <img
          src={generateIdenticon(name)}
          alt={displayName}
          className="avatar-identicon"
        />
      )}
      
      {!showImage && !showInitials && !showIdenticon && (
        <span className="avatar-fallback">?</span>
      )}
    </div>
  );
}
