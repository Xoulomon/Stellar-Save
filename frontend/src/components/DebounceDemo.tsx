import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { useDebounce, useDebounceWithCancel } from '../hooks/useDebounce';
import './DebounceDemo.css';

/**
 * Demo component showcasing the useDebounce hook functionality
 * 
 * This component demonstrates:
 * - Basic debouncing with default settings
 * - Custom delay configuration
 * - Leading edge updates
 * - Maximum wait time
 * - Cancel functionality
 */
export function DebounceDemo() {
  // Basic debounce example
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, { delay: 500 });
  const [searchCount, setSearchCount] = useState(0);
  const prevDebouncedSearchTerm = useRef<string>('');

  // Custom delay example
  const [customValue, setCustomValue] = useState('');
  const debouncedCustomValue = useDebounce(customValue, { delay: 1000 });

  // Leading edge example
  const [leadingValue, setLeadingValue] = useState('');
  const debouncedLeadingValue = useDebounce(leadingValue, {
    delay: 500,
    leading: true
  });

  // Max wait example
  const [maxWaitValue, setMaxWaitValue] = useState('');
  const debouncedMaxWaitValue = useDebounce(maxWaitValue, {
    delay: 500,
    maxWait: 2000
  });

  // Cancel example
  const [cancelValue, setCancelValue] = useState('');
  const { debouncedValue: debouncedCancelValue, cancel } = useDebounceWithCancel(
    cancelValue,
    { delay: 1000 }
  );

  // Track search API calls - use ref to avoid setState in effect
  useEffect(() => {
    if (debouncedSearchTerm && debouncedSearchTerm !== prevDebouncedSearchTerm.current) {
      prevDebouncedSearchTerm.current = debouncedSearchTerm;
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setSearchCount(prev => prev + 1);
      }, 0);
      console.log('Searching for:', debouncedSearchTerm);
    }
  }, [debouncedSearchTerm]);

  const handleReset = () => {
    setCancelValue('');
    cancel();
  };

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleCustomChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCustomValue(e.target.value);
  };

  const handleLeadingChange = (e: ChangeEvent<HTMLInputElement>) => {
    setLeadingValue(e.target.value);
  };

  const handleMaxWaitChange = (e: ChangeEvent<HTMLInputElement>) => {
    setMaxWaitValue(e.target.value);
  };

  const handleCancelChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCancelValue(e.target.value);
  };

  return (
    <div className="debounce-demo">
      <h1>useDebounce Hook Demo</h1>
      <p className="demo-description">
        This demo showcases various features of the useDebounce hook.
        Try typing in the inputs below to see how debouncing works!
      </p>

      {/* Basic Debounce */}
      <section className="demo-section">
        <h2>1. Basic Debounce (500ms)</h2>
        <p className="section-description">
          The debounced value updates 500ms after you stop typing.
          This is useful for search inputs to reduce API calls.
        </p>
        <div className="input-group">
          <label htmlFor="search">Search:</label>
          <input
            id="search"
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Type to search..."
            className="demo-input"
          />
        </div>
        <div className="output-group">
          <div className="output-item">
            <span className="output-label">Current Value:</span>
            <span className="output-value">{searchTerm || '(empty)'}</span>
          </div>
          <div className="output-item">
            <span className="output-label">Debounced Value:</span>
            <span className="output-value debounced">
              {debouncedSearchTerm || '(empty)'}
            </span>
          </div>
          <div className="output-item">
            <span className="output-label">API Calls Made:</span>
            <span className="output-value count">{searchCount}</span>
          </div>
        </div>
      </section>

      {/* Custom Delay */}
      <section className="demo-section">
        <h2>2. Custom Delay (1000ms)</h2>
        <p className="section-description">
          This example uses a longer 1-second delay before updating.
        </p>
        <div className="input-group">
          <label htmlFor="custom">Custom Delay:</label>
          <input
            id="custom"
            type="text"
            value={customValue}
            onChange={handleCustomChange}
            placeholder="Type here..."
            className="demo-input"
          />
        </div>
        <div className="output-group">
          <div className="output-item">
            <span className="output-label">Current Value:</span>
            <span className="output-value">{customValue || '(empty)'}</span>
          </div>
          <div className="output-item">
            <span className="output-label">Debounced Value:</span>
            <span className="output-value debounced">
              {debouncedCustomValue || '(empty)'}
            </span>
          </div>
        </div>
      </section>

      {/* Leading Edge */}
      <section className="demo-section">
        <h2>3. Leading Edge Update</h2>
        <p className="section-description">
          Updates immediately on the first change, then debounces subsequent changes.
          Great for immediate user feedback.
        </p>
        <div className="input-group">
          <label htmlFor="leading">Leading Edge:</label>
          <input
            id="leading"
            type="text"
            value={leadingValue}
            onChange={handleLeadingChange}
            placeholder="Type here..."
            className="demo-input"
          />
        </div>
        <div className="output-group">
          <div className="output-item">
            <span className="output-label">Current Value:</span>
            <span className="output-value">{leadingValue || '(empty)'}</span>
          </div>
          <div className="output-item">
            <span className="output-label">Debounced Value:</span>
            <span className="output-value debounced">
              {debouncedLeadingValue || '(empty)'}
            </span>
          </div>
        </div>
      </section>

      {/* Max Wait */}
      <section className="demo-section">
        <h2>4. Maximum Wait Time (2000ms)</h2>
        <p className="section-description">
          Forces an update after 2 seconds, even if you keep typing continuously.
          Useful for auto-save features.
        </p>
        <div className="input-group">
          <label htmlFor="maxwait">Max Wait:</label>
          <input
            id="maxwait"
            type="text"
            value={maxWaitValue}
            onChange={handleMaxWaitChange}
            placeholder="Keep typing continuously..."
            className="demo-input"
          />
        </div>
        <div className="output-group">
          <div className="output-item">
            <span className="output-label">Current Value:</span>
            <span className="output-value">{maxWaitValue || '(empty)'}</span>
          </div>
          <div className="output-item">
            <span className="output-label">Debounced Value:</span>
            <span className="output-value debounced">
              {debouncedMaxWaitValue || '(empty)'}
            </span>
          </div>
        </div>
      </section>

      {/* Cancel Functionality */}
      <section className="demo-section">
        <h2>5. Cancel Functionality</h2>
        <p className="section-description">
          Demonstrates manual cancellation of pending debounce updates.
        </p>
        <div className="input-group">
          <label htmlFor="cancel">With Cancel:</label>
          <input
            id="cancel"
            type="text"
            value={cancelValue}
            onChange={handleCancelChange}
            placeholder="Type here..."
            className="demo-input"
          />
          <button onClick={handleReset} className="reset-button">
            Reset & Cancel
          </button>
        </div>
        <div className="output-group">
          <div className="output-item">
            <span className="output-label">Current Value:</span>
            <span className="output-value">{cancelValue || '(empty)'}</span>
          </div>
          <div className="output-item">
            <span className="output-label">Debounced Value:</span>
            <span className="output-value debounced">
              {debouncedCancelValue || '(empty)'}
            </span>
          </div>
        </div>
      </section>

      {/* Usage Tips */}
      <section className="demo-section tips">
        <h2>💡 Usage Tips</h2>
        <ul>
          <li>
            <strong>Search inputs:</strong> Use 300-500ms delay to reduce API calls
          </li>
          <li>
            <strong>Form validation:</strong> Use 500-1000ms delay to avoid excessive checks
          </li>
          <li>
            <strong>Auto-save:</strong> Use maxWait to ensure periodic saves
          </li>
          <li>
            <strong>Leading edge:</strong> Use for immediate user feedback
          </li>
          <li>
            <strong>Cancel:</strong> Use when you need manual control over updates
          </li>
        </ul>
      </section>
    </div>
  );
}

export default DebounceDemo;
