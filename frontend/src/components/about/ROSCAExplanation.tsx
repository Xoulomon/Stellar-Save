import React from "react";

const ROSCAExplanation: React.FC = () => {
  return (
    <section className="py-20 bg-gray-900">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">What is a ROSCA?</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Rotating Savings and Credit Association — a time-tested savings
            method used by millions worldwide.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-gray-800 p-8 rounded-2xl">
            <div className="w-14 h-14 bg-yellow-400/10 rounded-xl flex items-center justify-center mb-6">
              👥
            </div>
            <h3 className="text-2xl font-semibold mb-3">Group Savings</h3>
            <p className="text-gray-400">
              A group of people agree to contribute a fixed amount regularly
              into a common pot.
            </p>
          </div>

          <div className="bg-gray-800 p-8 rounded-2xl">
            <div className="w-14 h-14 bg-yellow-400/10 rounded-xl flex items-center justify-center mb-6">
              🔄
            </div>
            <h3 className="text-2xl font-semibold mb-3">Rotating Payouts</h3>
            <p className="text-gray-400">
              Each cycle, one member receives the entire pot. The rotation
              continues until everyone has received once.
            </p>
          </div>

          <div className="bg-gray-800 p-8 rounded-2xl">
            <div className="w-14 h-14 bg-yellow-400/10 rounded-xl flex items-center justify-center mb-6">
              🔒
            </div>
            <h3 className="text-2xl font-semibold mb-3">Trust-Based</h3>
            <p className="text-gray-400">
              Traditionally based on trust. Stellar-Save makes it trustless
              using blockchain technology.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ROSCAExplanation;
