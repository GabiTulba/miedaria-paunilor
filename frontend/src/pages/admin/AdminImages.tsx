import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import './Admin.css'; // Assuming common admin styles

const AdminImages: React.FC = () => {
  const { token } = useAuth(); // Changed jwtToken to token
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setMessage('');
    } else {
      setSelectedFile(null);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      setMessage('Please select a file first.');
      return;
    }

    if (!token) { // Changed jwtToken to token
      setMessage('Authentication token not found. Please log in.');
      return;
    }

    setLoading(true);
    setMessage('Uploading...');

    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      const response = await axios.post('/api/admin/images/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`, // Changed jwtToken to token
        },
      });
      setMessage(`Upload successful: ${response.data.url}`);
      setSelectedFile(null); // Clear selected file after successful upload
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        setMessage(`Upload failed: ${error.response.data.message || error.response.statusText}`);
      } else {
        setMessage('Upload failed: An unknown error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-images-container">
      <h1>Upload Product Images</h1>
      <div className="upload-form">
        <input type="file" onChange={handleFileChange} accept="image/*" />
        <button onClick={handleFileUpload} disabled={!selectedFile || loading}>
          {loading ? 'Uploading...' : 'Upload Image'}
        </button>
      </div>
      {message && <p className="upload-message">{message}</p>}

      {/* Optionally, display previously uploaded images here */}
      <div className="uploaded-images-list">
        <h2>Uploaded Images</h2>
        <p>This section is for future implementation (e.g., displaying and managing uploaded images).</p>
      </div>
    </div>
  );
};

export default AdminImages;
