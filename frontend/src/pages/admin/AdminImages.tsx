import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api, getImageUrl } from '../../lib/api';
import ConfirmModal from '../../components/ConfirmModal';
import { useAdminImages } from '../../hooks/useAdminImages';
import './Admin.css';

const AdminImages: React.FC = () => {
  const { token } = useAuth();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { images, setImages, loading: imagesLoading, error: imagesError, refetch: fetchImages } = useAdminImages(token);
  const [renamingImageId, setRenamingImageId] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState<string>('');
  const [renameLoading, setRenameLoading] = useState<boolean>(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !token) return;

    setLoading(true);

    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      const newImage = await api.uploadImage(formData, token);
      setImages((prevImages) => [...prevImages, newImage]);
      showToast(`${t('common.success')}: ${newImage.file_name}`, 'success');
      setSelectedFile(null);
    } catch (error: any) {
      showToast(`${t('common.error')}: ${error.response?.data?.message || error.message}`, 'error');
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
    if (!newFileName.trim() || !token) return;
    setRenameLoading(true);
    try {
      const updatedImage = await api.updateImage(imageId, newFileName, token);
      setImages((prevImages) =>
        prevImages.map((img) => (img.id === imageId ? updatedImage : img))
      );
      showToast(`${t('common.success')}: ${updatedImage.file_name}`, 'success');
      handleCancelRename();
    } catch (error: any) {
      showToast(`${t('common.error')}: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setRenameLoading(false);
    }
  };

  const handleDeleteClick = (imageId: string) => {
    setConfirmDeleteId(imageId);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId || !token) return;
    const imageId = confirmDeleteId;
    setConfirmDeleteId(null);
    setDeleteLoading(imageId);
    try {
      await api.deleteImage(imageId, token);
      setImages((prevImages) => prevImages.filter((img) => img.id !== imageId));
      showToast(t('admin.images.deleteSuccess'), 'success');
    } catch (error: any) {
      if (error.response && error.response.status === 409) {
        showToast(t('admin.images.deleteError'), 'error');
      } else {
        showToast(`${t('common.error')}: ${error.response?.data?.message || error.message}`, 'error');
      }
    } finally {
      setDeleteLoading(null);
    }
  };

  return (
    <div className="admin-images-container">
      <div className="page-header">
        <div>
          <h1>{t('admin.images.title')}</h1>
          <p className="page-subtitle">{t('admin.images.subtitle')}</p>
        </div>
      </div>

      <div className="images-grid">
        <div className="upload-section card">
          <div className="upload-header">
            <h2>{t('admin.images.upload')}</h2>
            <div className="upload-icon upload-icon-symbol"></div>
          </div>
          <div className="upload-area" onClick={() => document.getElementById('file-input')?.click()}>
            <div className="upload-placeholder">
              <div className="upload-placeholder-icon image-icon"></div>
              <p>{t('admin.images.dragDrop')}</p>
              <p className="upload-hint">{t('admin.images.supportedFormats')}, {t('admin.images.maxSize')}</p>
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
            {loading ? t('admin.images.uploading') : t('admin.images.upload')}
          </button>
        </div>

        <div className="images-section card">
          <div className="section-header">
            <h2>{t('admin.images.title')}</h2>
            <div className="section-info">
              <span className="image-count">{images.length} {t('admin.images.images')}</span>
              {images.length > 0 && (
                <span className="total-size">
                  {t('common.total')}: {(images.reduce((sum, img) => sum + img.file_size, 0) / (1024 * 1024)).toFixed(2)} MB
                </span>
              )}
            </div>
          </div>

          {imagesError ? (
            <div className="error-state">
              <div className="error-icon warning-icon"></div>
              <p className="error-message">{imagesError}</p>
              <button onClick={fetchImages} className="button button-secondary">{t('admin.products.retry')}</button>
            </div>
          ) : images.length === 0 && !imagesLoading ? (
            <div className="empty-state">
              <div className="empty-state-icon image-icon"></div>
              <h3>{t('admin.images.noImages')}</h3>
              <p>{t('admin.images.noImagesDescription')}</p>
            </div>
          ) : (
            <div className="images-grid-view">
              {images.map((image) => (
                <div key={image.id} className="image-card">
                  <div className="image-preview">
                    <img
                      src={getImageUrl(image.id)}
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
                            {t('common.save')}
                          </button>
                          <button 
                            onClick={handleCancelRename} 
                            disabled={renameLoading}
                            className="button button-small button-secondary"
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="image-info">
                    <div className="image-name">
                      {renamingImageId === image.id ? (
                        <div className="renaming-indicator">{t('admin.images.rename')}</div>
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
                          {t('admin.images.rename')}
                        </button>
                        <button
                          onClick={() => handleDeleteClick(image.id)}
                          disabled={deleteLoading === image.id}
                          className="button button-small button-danger"
                        >
                          {deleteLoading === image.id ? t('admin.images.delete') : t('admin.images.delete')}
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
      {confirmDeleteId && (
        <ConfirmModal
          title={t('confirm.delete.title')}
          message={t('confirm.delete.imageMessage')}
          confirmLabel={t('confirm.delete.confirm')}
          cancelLabel={t('common.cancel')}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDeleteId(null)}
          variant="danger"
        />
      )}
    </div>
  );
};

export default AdminImages;