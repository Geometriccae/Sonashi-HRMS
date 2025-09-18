import config from "../config/config";

const baseUrl = `${config.API_BASE_URL}/api/auth`;

const getAuthToken = () => localStorage.getItem('token');

const getMe = async () => {
  const response = await fetch(`${baseUrl}/me`, {
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
    }
  });
  if (!response.ok) throw new Error('Failed to fetch user');
  return response.json();
};

const updateMe = async ({ username, phoneNumber, newPassword, emailId }) => {
  const response = await fetch(`${baseUrl}/me`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({ username, phoneNumber, newPassword, emailId })
  });
  if (!response.ok) throw new Error('Failed to update user');
  return response.json();
};

const uploadProfilePicture = async (file) => {
  const formData = new FormData();
  formData.append('profilePicture', file);
  const response = await fetch(`${baseUrl}/me/profile-picture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: formData
  });
  if (!response.ok) throw new Error('Failed to upload profile picture');
  return response.json();
};

const UserService = { getMe, updateMe, uploadProfilePicture };
export default UserService;


