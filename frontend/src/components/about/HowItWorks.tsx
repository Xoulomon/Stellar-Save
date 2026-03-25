import React from 'react';

const steps = [
  {
    number: "01",
    title: "Create or Join a Group",
    description: "Start a new ROSCA or join an existing one with friends, family, or colleagues."
  },
  {
    number: "02",
    title: "Make Regular Contributions",
    description: "Everyone contributes the agreed amount on time using Stellar payments."
  },
  {
    number: "03",
    title: "Receive Your Turn",
    description: "When it's your turn, you receive the full pot automatically via smart contract logic."
  },
  {
    number: "04",
    title: "Transparent & Secure",
    description: "Every transaction is recorded on the Stellar blockchain — fully auditable by all members."
  }
];

const HowItWorks: React.FC = () => {
  return (
    <section className="py-20">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">How Stellar-Save Works</h2>
          <p className="text-gray-400 text-lg">Simple, transparent, and powered by Stellar</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="relative bg-gray-900 p-8 rounded-3xl border border-gray-800">
              <div className="text-6xl font-bold text-yellow-400/20 mb-6">{step.number}</div>
              <h3 className="text-2xl font-semibold mb-4">{step.title}</h3>
              <p className="text-gray-400 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;