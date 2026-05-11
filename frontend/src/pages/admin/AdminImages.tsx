import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import ConfirmModal from '../../components/ConfirmModal';
import { useAdminImages } from '../../hooks/useAdminImages';
import { useImageUpload } from '../../hooks/useImageUpload';
import { Skeleton } from '../../components/Skeleton';
import ImageCard from '../../components/admin/ImageCard';
import './Admin.css';

const AdminImages: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { images, setImages, loading: imagesLoading, error: imagesError, refetch: fetchImages } = useAdminImages();
  const [renamingImageId, setRenamingImageId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  const onUploadError = useCallback((message: string) => {
    showToast(`${t('common.error')}: ${message}`, 'error');
  }, [showToast, t]);
  const { progress: uploadProgress, uploading, upload } = useImageUpload({ onError: onUploadError });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] ?? null);
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

  const handleFileUpload = async () => {
    if (!selectedFile) return;
    const newImage = await upload(selectedFile);
    if (newImage) {
      setImages((prev) => [...prev, newImage]);
      showToast(`${t('common.success')}: ${newImage.file_name}`, 'success');
      setSelectedFile(null);
    }
  };

  const handleSaveRename = async (imageId: string, newFileName: string) => {
    try {
      const updatedImage = await api.updateImage(imageId, newFileName);
      setImages((prev) => prev.map((img) => (img.id === imageId ? updatedImage : img)));
      showToast(`${t('common.success')}: ${updatedImage.file_name}`, 'success');
      setRenamingImageId(null);
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      showToast(`${t('common.error')}: ${err.response?.data?.message || err.message}`, 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    const imageId = confirmDeleteId;
    setConfirmDeleteId(null);
    setDeleteLoading(imageId);
    try {
      await api.deleteImage(imageId);
      setImages((prev) => prev.filter((img) => img.id !== imageId));
      showToast(t('admin.images.deleteSuccess'), 'success');
    } catch (error) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      if (err.response?.status === 409) {
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
            disabled={!selectedFile || uploading}
            className="button button-primary upload-button"
          >
            {uploading ? t('admin.images.uploading') : t('admin.images.upload')}
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
                    <Skeleton w="100%" h="100%" style={{ minHeight: '200px' }} />
                  </div>
                  <div className="image-info">
                    <div className="image-name">
                      <Skeleton inline h="1em" w="70%" />
                    </div>
                    <div className="image-meta">
                      <Skeleton inline h="0.85em" w="50%" />
                    </div>
                  </div>
                  <div className="image-actions">
                    <Skeleton inline h="1em" w="100%" />
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
                <ImageCard
                  key={image.id}
                  image={image}
                  isRenaming={renamingImageId === image.id}
                  deleteLoading={deleteLoading === image.id}
                  onStartRename={() => setRenamingImageId(image.id)}
                  onCancelRename={() => setRenamingImageId(null)}
                  onSaveRename={(newName) => handleSaveRename(image.id, newName)}
                  onDelete={() => setConfirmDeleteId(image.id)}
                />
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
