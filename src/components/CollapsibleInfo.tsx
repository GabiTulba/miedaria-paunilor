// src/components/CollapsibleInfo.tsx
'use client';
import { useState } from 'react';

const CollapsibleInfo = ({ description, characteristics, ingredients }: { description: string, characteristics: any, ingredients: string[] }) => {
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  return (
    <div>
      <div className="border-b">
        <button
          onClick={() => toggleSection('description')}
          className="w-full text-left py-4 flex justify-between items-center"
        >
          <span className="text-xl font-bold">Description</span>
          <span>{openSection === 'description' ? '-' : '+'}</span>
        </button>
        {openSection === 'description' && (
          <div className="py-4">
            <p>{description}</p>
          </div>
        )}
      </div>
      <div className="border-b">
        <button
          onClick={() => toggleSection('characteristics')}
          className="w-full text-left py-4 flex justify-between items-center"
        >
          <span className="text-xl font-bold">Characteristics</span>
          <span>{openSection === 'characteristics' ? '-' : '+'}</span>
        </button>
        {openSection === 'characteristics' && (
          <div className="py-4">
            <ul>
              {Object.entries(characteristics).map(([key, value]) => (
                <li key={key}><strong>{key.charAt(0).toUpperCase() + key.slice(1)}:</strong> {value as string}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="border-b">
        <button
          onClick={() => toggleSection('ingredients')}
          className="w-full text-left py-4 flex justify-between items-center"
        >
          <span className="text-xl font-bold">Ingredients</span>
          <span>{openSection === 'ingredients' ? '-' : '+'}</span>
        </button>
        {openSection === 'ingredients' && (
          <div className="py-4">
            <ul>
              {ingredients.map((ingredient) => (
                <li key={ingredient}>{ingredient}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default CollapsibleInfo;
