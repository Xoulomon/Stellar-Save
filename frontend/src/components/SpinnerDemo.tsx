import { useState } from 'react';
import { Spinner, FullPageLoader } from './Spinner';
import './SpinnerDemo.css';

/**
 * Demo component showcasing all Spinner variations
 */
export function SpinnerDemo() {
  const [showFullPageLoader, setShowFullPageLoader] = useState(false);

  return (
    <div className="spinner-demo">
      <h1>Spinner Component Demo</h1>

      {/* Size Variants */}
      <section className="demo-section">
        <h2>Size Variants</h2>
        <div className="demo-grid">
          <div className="demo-item">
            <p className="demo-label">Small</p>
            <Spinner size="sm" label="Loading" />
          </div>
          <div className="demo-item">
            <p className="demo-label">Medium (Default)</p>
            <Spinner size="md" label="Loading" />
          </div>
          <div className="demo-item">
            <p className="demo-label">Large</p>
            <Spinner size="lg" label="Loading" />
          </div>
        </div>
      </section>

      {/* Color Variants */}
      <section className="demo-section">
        <h2>Color Variants</h2>
        <div className="demo-grid">
          <div className="demo-item">
            <p className="demo-label">Primary (Default)</p>
            <Spinner color="primary" label="Loading" />
          </div>
          <div className="demo-item">
            <p className="demo-label">Secondary</p>
            <Spinner color="secondary" label="Loading" />
          </div>
          <div className="demo-item">
            <p className="demo-label">Danger</p>
            <Spinner color="danger" label="Loading" />
          </div>
          <div className="demo-item">
            <p className="demo-label">Success</p>
            <Spinner color="success" label="Loading" />
          </div>
        </div>
      </section>

      {/* Without Label */}
      <section className="demo-section">
        <h2>Without Loading Text</h2>
        <div className="demo-grid">
          <div className="demo-item">
            <p className="demo-label">Small</p>
            <Spinner size="sm" />
          </div>
          <div className="demo-item">
            <p className="demo-label">Medium</p>
            <Spinner size="md" />
          </div>
          <div className="demo-item">
            <p className="demo-label">Large</p>
            <Spinner size="lg" />
          </div>
        </div>
      </section>

      {/* Full-Page Loader */}
      <section className="demo-section">
        <h2>Full-Page Loader</h2>
        <button
          className="demo-button"
          onClick={() => setShowFullPageLoader(!showFullPageLoader)}
        >
          {showFullPageLoader ? 'Hide' : 'Show'} Full-Page Loader
        </button>
        <FullPageLoader
          loading={showFullPageLoader}
          message="Loading your data..."
        />
      </section>

      {/* Combined Variants */}
      <section className="demo-section">
        <h2>Size + Color Combinations</h2>
        <div className="demo-grid">
          <div className="demo-item">
            <p className="demo-label">Small Success</p>
            <Spinner size="sm" color="success" label="Success" />
          </div>
          <div className="demo-item">
            <p className="demo-label">Medium Danger</p>
            <Spinner size="md" color="danger" label="Error" />
          </div>
          <div className="demo-item">
            <p className="demo-label">Large Secondary</p>
            <Spinner size="lg" color="secondary" label="Processing" />
          </div>
        </div>
      </section>
    </div>
  );
}
