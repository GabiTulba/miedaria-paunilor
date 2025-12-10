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
      <div className="page-header">
        <div>
          <h1>Manage Product Images</h1>
          <p className="page-subtitle">Upload and manage images for your products</p>
        </div>
      </div>

      <div className="images-grid">
        <div className="upload-section card">
          <div className="upload-header">
            <h2>Upload New Image</h2>
            <div className="upload-icon upload-icon-symbol"></div>
          </div>
          <div className="upload-area" onClick={() => document.getElementById('file-input')?.click()}>
            <div className="upload-placeholder">
              <div className="upload-placeholder-icon image-icon"></div>
              <p>Click to select or drag and drop</p>
              <p className="upload-hint">Supports JPG, PNG, GIF up to 5MB</p>
            </div>
            <input 
              id="file-input"
              type="file" 
              onChange={handleFileChange} 
              accept="image/*" 
              style={{ display: 'none' }}
            />
          </div>
          {selectedFile && (
            <div className="selected-file">
              <div className="file-info">
                <span className="file-name">{selectedFile.name}</span>
                <span className="file-size">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
              </div>
            </div>
          )}
          <button 
            onClick={handleFileUpload} 
            disabled={!selectedFile || loading}
            className="button button-primary upload-button"
          >
            {loading ? 'Uploading...' : 'Upload Image'}
          </button>
          {message && (
            <div className={`message ${message.includes('successful') ? 'message-success' : 'message-error'}`}>
              {message}
            </div>
          )}
        </div>

        <div className="images-section card">
          <div className="section-header">
            <h2>Existing Images</h2>
            <div className="section-info">
              <span className="image-count">{images.length} images</span>
              {images.length > 0 && (
                <span className="total-size">
                  Total: {(images.reduce((sum, img) => sum + img.file_size, 0) / (1024 * 1024)).toFixed(2)} MB
                </span>
              )}
            </div>
          </div>

          {imagesLoading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Loading images...</p>
            </div>
          ) : imagesError ? (
            <div className="error-state">
              <div className="error-icon warning-icon"></div>
              <p className="error-message">{imagesError}</p>
              <button onClick={fetchImages} className="button button-secondary">Retry</button>
            </div>
          ) : images.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon image-icon"></div>
              <h3>No images uploaded yet</h3>
              <p>Upload your first product image to get started</p>
            </div>
          ) : (
            <div className="images-grid-view">
              {images.map((image) => (
                <div key={image.id} className="image-card">
                  <div className="image-preview">
                    <img
                      src={`/images/${image.id}`}
                      alt={image.file_name}
                      className="image-thumbnail"
                    />
                    {renamingImageId === image.id ? (
                      <div className="rename-overlay">
                        <input
                          type="text"
                          value={newFileName}
                          onChange={(e) => setNewFileName(e.target.value)}
                          disabled={renameLoading}
                          className="rename-input"
                          autoFocus
                        />
                        <div className="rename-actions">
                          <button 
                            onClick={() => handleSaveRename(image.id)} 
                            disabled={renameLoading}
                            className="button button-small button-success"
                          >
                            Save
                          </button>
                          <button 
                            onClick={handleCancelRename} 
                            disabled={renameLoading}
                            className="button button-small button-secondary"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="image-info">
                    <div className="image-name">
                      {renamingImageId === image.id ? (
                        <div className="renaming-indicator">Renaming...</div>
                      ) : (
                        <>
                          <span className="file-name">{image.file_name}</span>
                          <span className="file-size">({(image.file_size / 1024).toFixed(1)} KB)</span>
                        </>
                      )}
                    </div>
                    <div className="image-meta">
                      <span className="image-id">ID: {image.id.substring(0, 8)}...</span>
                      <span className="image-date">{new Date(image.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="image-actions">
                    {renamingImageId === image.id ? null : (
                      <>
                        <button 
                          onClick={() => handleRenameClick(image)}
                          className="button button-small button-secondary"
                          disabled={deleteLoading === image.id}
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => handleDeleteImage(image.id)}
                          disabled={deleteLoading === image.id}
                          className="button button-small button-danger"
                        >
                          {deleteLoading === image.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminImages;