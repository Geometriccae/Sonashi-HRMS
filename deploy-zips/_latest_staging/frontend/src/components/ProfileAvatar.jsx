import React, { useEffect, useState } from "react";
import UserService from "../services/UserService";
import config, { buildImageUrl } from "../config/config";

function ProfileAvatar({ size = 32, className = "", userData = null }) {
  const [user, setUser] = useState(userData);

  useEffect(() => {
    if (userData) {
      setUser(userData);
    } else {
      (async () => {
        try {
          const me = await UserService.getMe();
          setUser(me);
        } catch (e) { }
      })();
    }
  }, [userData]);

  const src = buildImageUrl(user?.profilePicture);

  const onImageError = (e) => {
    const currentSrc = e.target.src;
    const productionBase = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    if (!currentSrc.startsWith(productionBase)) {
      const path = new URL(currentSrc).pathname;
      e.target.src = `${productionBase}${path}`;
    } else {
      e.target.style.display = 'none';
    }
  };

  if (src) {
    return (
      <img
        src={src}
        alt="profile"
        width={size}
        height={size}
        style={{ borderRadius: '50%', objectFit: 'cover' }}
        className={className}
        onError={onImageError}
      />
    );
  }

  const initial = (user?.username || 'U').charAt(0).toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600
      }}
      className={className}
    >
      {initial}
    </div>
  );
}

export default ProfileAvatar;


