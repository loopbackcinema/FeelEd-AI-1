
export const GRADES = Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`);

export const LANGUAGES = [
  "English", "Spanish", "French", "German", "Mandarin Chinese", "Hindi", 
  "Arabic", "Bengali", "Russian", "Portuguese", "Indonesian", "Urdu", 
  "Japanese", "Swahili", "Tamil", "Telugu", "Kannada", "Malayalam", 
  "Marathi", "Gujarati", "Punjabi", "Odia", "Assamese"
];

export const EMOTIONS = ["Curious", "Inspiring", "Funny", "Moral"];

export const USER_ROLES = ["Teacher", "Student", "Parent"];

// A generic, gray SVG avatar for guest users, encoded as a data URI.
export const GUEST_AVATAR_URL = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI0EwQTBCMyI+PHBhdGggZD0iTTEyIDJDNi44OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MxLjY2IDAgMyAxLjM0IDMgM3MtMS4zNCAzLTMgMy0zLTEuMzQtMy0zIDEuMzQtMyAzIDN6bTAgMTRjLTIuMDMgMC0zLjg0LS44MS01LjE1LTIuMTFDOC4yOCAxNS40NSAxMC4xMyAxNSAxMiAxNXMzLjcyLjQ1IDUuMTUgMS44OUMxNS44NCAxOC4xOSAxNC4wMyAxOSAxMiAxOXoiLz48L3N2Zz4=';
