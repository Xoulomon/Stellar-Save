import React, { useState } from "react";

const faqs = [
  {
    question: "What happens if someone misses a contribution?",
    answer:
      "The group can set rules in advance. Stellar-Save can automatically pause payouts or apply penalties if configured.",
  },
  {
    question: "Is my money safe on Stellar?",
    answer:
      "Yes. All funds are held in escrow smart contracts on the Stellar network. No one can access the pot except through predefined rules.",
  },
  {
    question: "Can I leave a ROSCA before it finishes?",
    answer:
      "Yes, but depending on the group rules you may forfeit your contributions or need group approval.",
  },
  {
    question: "What are the fees?",
    answer:
      "Very low — only standard Stellar network fees (usually less than $0.01 per transaction).",
  },
  {
    question: "Is Stellar-Save available worldwide?",
    answer:
      "Yes! Anyone with a Stellar wallet can participate. No bank account required.",
  },
];

const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-20 bg-gray-900">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-gray-400">Got questions? We’ve got answers.</p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-8 py-6 text-left flex justify-between items-center hover:bg-gray-700 transition"
              >
                <span className="font-medium text-lg">{faq.question}</span>
                <span className="text-2xl text-yellow-400">
                  {openIndex === index ? "−" : "+"}
                </span>
              </button>
              {openIndex === index && (
                <div className="px-8 pb-8 text-gray-400 leading-relaxed">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQ;
