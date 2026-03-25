import React from 'react';
import ROSCAExplanation from '../components/about/ROSCAExplanation';
import HowItWorks from '../components/about/HowItWorks';
import FAQ from '../components/about/FAQ';

const AboutPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-purple-900 via-indigo-900 to-gray-950 py-20">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
            About Stellar-Save
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            The modern, transparent, and secure way to do ROSCA on the Stellar network.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16 space-y-24">
        <ROSCAExplanation />
        <HowItWorks />
        <FAQ />
      </div>

      {/* Final CTA */}
      <div className="bg-gray-900 py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-semibold mb-4">Ready to start saving together?</h2>
          <p className="text-gray-400 mb-8">
            Join thousands of people already building financial freedom on Stellar.
          </p>
          <a
            href="/dashboard"
            className="inline-block bg-white text-black font-medium px-8 py-4 rounded-2xl hover:bg-gray-200 transition"
          >
            Get Started Now
          </a>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;