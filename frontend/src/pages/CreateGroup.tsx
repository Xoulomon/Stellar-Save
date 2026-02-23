import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { ROUTES } from '../constants/routes';

export default function CreateGroup() {
  const navigate = useNavigate();
  const addGroup = useStore((state) => state.addGroup);

  const [formData, setFormData] = useState({
    name: '',
    targetAmount: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newGroup = {
      name: formData.name,
      targetAmount: Number(formData.targetAmount),
    };

    addGroup(newGroup);
    navigate(ROUTES.GROUPS);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="create-group-page">
      <header>
        <h1>Create New Savings Group</h1>
      </header>

      <form onSubmit={handleSubmit} className="create-group-form">
        <div className="form-group">
          <label htmlFor="name">Group Name</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="Enter group name"
          />
        </div>

        <div className="form-group">
          <label htmlFor="targetAmount">Target Amount (XLM)</label>
          <input
            type="number"
            id="targetAmount"
            name="targetAmount"
            value={formData.targetAmount}
            onChange={handleChange}
            required
            min="1"
            step="0.01"
            placeholder="Enter target amount"
          />
        </div>

        <div className="form-actions">
          <button type="button" onClick={() => navigate(-1)} className="button">
            Cancel
          </button>
          <button type="submit" className="button primary">
            Create Group
          </button>
        </div>
      </form>
    </div>
  );
}
