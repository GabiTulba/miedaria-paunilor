import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getImageUrl } from '../../lib/api';
import { Image } from '../../types';
import ConfirmModal from '../../components/ConfirmModal';
import { useAdminImages } from '../../hooks/useAdminImages';
import { useFormattedDate } from '../../hooks/useFormattedDate';
import './Admin.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const AdminImages: React.FC = () => {
  const { token } = useAuth();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const formatDate = useFormattedDate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
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

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  };

  const handleFileUpload = () => {
    if (!selectedFile || !token) return;

    setLoading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('image', selectedFile);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/admin/images`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      setLoading(false);
      setUploadProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const newImage: Image = JSON.parse(xhr.responseText);
          setImages((prevImages) => [...prevImages, newImage]);
          showToast(`${t('common.success')}: ${newImage.file_name}`, 'success');
          setSelectedFile(null);
        } catch {
          showToast(t('common.error'), 'error');
        }
      } else {
        try {
          const body = JSON.parse(xhr.responseText);
          showToast(`${t('common.error')}: ${body?.message || xhr.statusText}`, 'error');
        } catch {
          showToast(`${t('common.error')}: ${xhr.statusText}`, 'error');
        }
      }
    };

    xhr.onerror = () => {
      setLoading(false);
      setUploadProgress(null);
      showToast(t('common.error'), 'error');
    };

    xhr.send(formData);
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
      const { api } = await import('../../lib/api');
      const updatedImage = await api.updateImage(imageId, newFileName, token);
      setImages((prevImages) =>
        prevImages.map((img) => (img.id === imageId ? updatedImage : img))
      );
      showToast(`${t('common.success')}: ${updatedImage.file_name}`, 'success');
      handleCancelRename();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      showToast(`${t('common.error')}: ${err.response?.data?.message || err.message}`, 'error');
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
      const { api } = await import('../../lib/api');
      await api.deleteImage(imageId, token);
      setImages((prevImages) => prevImages.filter((img) => img.id !== imageId));
      showToast(t('admin.images.deleteSuccess'), 'success');
    } catch (error) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      if (err.response && err.response.status === 409) {
        showToast(t('admin.images.deleteError'), 'error');
      } else {
        showToast(`${t('common.error')}: ${err.response?.data?.message || err.message}`, 'error');
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
          <div
            className={`upload-area${isDragging ? ' upload-area--dragging' : ''}`}
            onClick={() => document.getElementById('file-input')?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
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
          {uploadProgress !== null && (
            <div className="upload-progress">
              <progress value={uploadProgress} max={100} className="upload-progress-bar" />
              <span className="upload-progress-label">{uploadProgress}%</span>
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
          ) : imagesLoading ? (
            <div className="images-grid-view">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="image-card">
                  <div className="image-preview">
                    <div className="skeleton" style={{ width: '100%', height: '100%', minHeight: '200px' }} />
                  </div>
                  <div className="image-info">
                    <div className="image-name">
                      <span className="skeleton" style={{ display: 'inline-block', height: '1em', width: '70%' }} />
                    </div>
                    <div className="image-meta">
                      <span className="skeleton" style={{ display: 'inline-block', height: '0.85em', width: '50%' }} />
                    </div>
                  </div>
                  <div className="image-actions">
                    <span className="skeleton" style={{ display: 'inline-block', height: '1em', width: '100%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : images.length === 0 ? (
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
                      <div className="rename-overlay" role="dialog" aria-modal="true">
                        <div className="rename-dialog">
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
                      <span className="image-date">{formatDate(image.created_at)}</span>
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
                          {deleteLoading === image.id ? t('common.deleting') : t('admin.images.delete')}
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
