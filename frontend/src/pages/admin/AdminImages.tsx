import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Image } from '../../types'; // Assuming you have an Image type
import './Admin.css'; // Assuming common admin styles

const AdminImages: React.FC = () => {
  const { token } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [images, setImages] = useState<Image[]>([]);
  const [imagesLoading, setImagesLoading] = useState<boolean>(true);
  const [imagesError, setImagesError] = useState<string>('');
  const [renamingImageId, setRenamingImageId] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState<string>('');
  const [renameLoading, setRenameLoading] = useState<boolean>(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  const fetchImages = async () => {
    if (!token) {
      setImagesError('Authentication token not found. Please log in.');
      setImagesLoading(false);
      return;
    }
    setImagesLoading(true);
    setImagesError('');
    try {
      const fetchedImages = await api.getImages(token);
      setImages(fetchedImages);
    } catch (error: any) {
      setImagesError(`Failed to fetch images: ${error.response?.data?.message || error.message}`);
    } finally {
      setImagesLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, [token]);

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
    if (!token) {
      setMessage('Authentication token not found. Please log in.');
      return;
    }

    setLoading(true);
    setMessage('Uploading...');

    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      const newImage = await api.uploadImage(formData, token);
      setImages((prevImages) => [...prevImages, newImage]);
      setMessage(`Upload successful: ${newImage.file_name}`);
      setSelectedFile(null);
    } catch (error: any) {
      setMessage(`Upload failed: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRenameClick = (image: Image) => {
    setRenamingImageId(image.id);
    setNewFileName(image.file_name);
  };

  const handleCancelRename = () => {
    setRenamingImageId(null);
    setNewFileName('');
  };

  const handleSaveRename = async (imageId: string) => {
    if (!newFileName.trim()) {
      setMessage('File name cannot be empty.');
      return;
    }
    if (!token) {
      setMessage('Authentication token not found. Please log in.');
      return;
    }
    setRenameLoading(true);
    setMessage('Renaming...');
    try {
      const updatedImage = await api.updateImage(imageId, newFileName, token);
      setImages((prevImages) =>
        prevImages.map((img) => (img.id === imageId ? updatedImage : img))
      );
      setMessage(`Image renamed to: ${updatedImage.file_name}`);
      handleCancelRename();
    } catch (error: any) {
      setMessage(`Rename failed: ${error.response?.data?.message || error.message}`);
    } finally {
      setRenameLoading(false);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!window.confirm('Are you sure you want to delete this image?')) {
      return;
    }
    if (!token) {
      setMessage('Authentication token not found. Please log in.');
      return;
    }
    setDeleteLoading(imageId);
    setMessage('Deleting...');
    try {
      await api.deleteImage(imageId, token);
      setImages((prevImages) => prevImages.filter((img) => img.id !== imageId));
      setMessage('Image deleted successfully.');
    } catch (error: any) {
      if (error.response && error.response.status === 409) {
        setMessage('Delete failed: This image is currently in use by one or more products.');
      } else {
        setMessage(`Delete failed: ${error.response?.data?.message || error.message}`);
      }
    } finally {
      setDeleteLoading(null);
    }
  };

  return (
    <div className="admin-images-container">
      <h1>Manage Product Images</h1>

      <div className="upload-form card">
        <h2>Upload New Image</h2>
        <input type="file" onChange={handleFileChange} accept="image/*" />
        <button onClick={handleFileUpload} disabled={!selectedFile || loading}>
          {loading ? 'Uploading...' : 'Upload Image'}
        </button>
        {message && <p className="upload-message">{message}</p>}
      </div>

      <div className="uploaded-images-list card">
        <h2>Existing Images</h2>
        {imagesLoading ? (
          <p>Loading images...</p>
        ) : imagesError ? (
          <p className="error-message">{imagesError}</p>
        ) : images.length === 0 ? (
          <p>No images uploaded yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Preview</th>
                <th>File Name</th>
                <th>ID</th>
                <th>Size (bytes)</th>
                <th>Uploaded On</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {images.map((image) => (
                <tr key={image.id}>
                  <td>
                    <img
                      src={`/images/${image.id}`}
                      alt={image.file_name}
                      style={{ width: '50px', height: '50px', objectFit: 'cover' }}
                    />
                  </td>
                  <td>
                    {renamingImageId === image.id ? (
                      <input
                        type="text"
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        disabled={renameLoading}
                      />
                    ) : (
                      image.file_name
                    )}
                  </td>
                  <td>{image.id}</td>
                  <td>{image.file_size}</td>
                  <td>{new Date(image.created_at).toLocaleDateString()}</td>
                  <td>
                    {renamingImageId === image.id ? (
                      <>
                        <button onClick={() => handleSaveRename(image.id)} disabled={renameLoading}>
                          Save
                        </button>
                        <button onClick={handleCancelRename} disabled={renameLoading}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleRenameClick(image)}>Rename</button>
                        <button
                          onClick={() => handleDeleteImage(image.id)}
                          disabled={deleteLoading === image.id}
                        >
                          {deleteLoading === image.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminImages;