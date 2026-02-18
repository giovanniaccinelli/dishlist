'use client';

import { useState } from 'react';
import { uploadImage, saveDishToFirestore } from '../app/lib/firebaseHelpers';
import { useAuth } from '../app/lib/auth';

export default function UploadModal({ onClose, onDishAdded }) {
  const { user } = useAuth();
  const [dishName, setDishName] = useState('');
  const [dishDescription, setDishDescription] = useState('');
  const [dishImage, setDishImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setDishImage(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handlePost = async () => {
    if (!dishName) {
      alert('Please provide a dish name.');
      return;
    }
    if (!user) {
      alert('You must be logged in.');
      return;
    }

    setLoading(true);
    try {
      // Upload image
      let imageURL = '';
      if (dishImage) {
        imageURL = await uploadImage(dishImage, user.uid);
        if (!imageURL) throw new Error('Image upload failed');
      }

      // Save dish in Firestore
      await saveDishToFirestore({
        name: dishName,
        description: dishDescription || '',
        imageURL,
        owner: user.uid,
        ownerName: user.displayName || "Anonymous",
        createdAt: new Date(),
      });

      // Refresh parent list after upload
      if (typeof onDishAdded === 'function') {
        await onDishAdded(); // <-- THIS refreshes profile dishes
      }

      // Reset and close
      setDishName('');
      setDishDescription('');
      setDishImage(null);
      setPreview(null);
      onClose();
    } catch (error) {
      alert('Upload failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-neutral-900 p-6 rounded-3xl shadow-2xl w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Add a Dish</h2>
        <input
          value={dishName}
          onChange={(e) => setDishName(e.target.value)}
          type="text"
          placeholder="Dish name"
          className="w-full p-3 mb-4 rounded-xl bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
          disabled={loading}
        />
        <textarea
          value={dishDescription}
          onChange={(e) => setDishDescription(e.target.value)}
          placeholder="Description"
          className="w-full p-3 mb-4 rounded-xl bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
          rows={3}
          disabled={loading}
        />
        <input
          type="file"
          onChange={handleImageUpload}
          className="w-full mb-4 text-white"
          disabled={loading}
          accept="image/*"
        />
        {preview && (
          <img
            src={preview}
            alt="Preview"
            className="w-full h-48 object-cover rounded-xl mb-4"
          />
        )}
        <div className="flex gap-4">
          <button
            onClick={handlePost}
            disabled={loading}
            className="bg-red-500 hover:bg-red-600 flex-1 py-3 rounded-xl font-semibold"
          >
            {loading ? 'Uploading...' : 'Post'}
          </button>
          <button
            onClick={() => !loading && onClose()}
            disabled={loading}
            className="bg-neutral-700 hover:bg-neutral-600 flex-1 py-3 rounded-xl font-semibold"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
