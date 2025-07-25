"use client";
import { Button } from "@/components/ui/button";
import React, { useState } from "react";
import { loadRazorpayScript } from "@/lib/razorpay-client";
import { useToast } from "@/components/ui/use-toast";
export default function Pricing({
  initialSubscriptionInfo,
  userId,
}: {
  initialSubscriptionInfo: string | undefined;
  userId: string | undefined;
}) {
  const { toast } = useToast();
  const [subscriptionInfo, setSubscriptionInfo] = useState<string | undefined>(
    initialSubscriptionInfo
  );
  const paymentHandler = async (
    amount: number,
    userId: string,
    metadata?: Record<string, any>
  ) => {
    const res = await loadRazorpayScript();
    if (!res) {
      alert("Razorpay SDK failed to load. Are you online?");
      return;
    }

    const orderRes = await fetch("/api/razorpay-order", {
      method: "POST",
      body: JSON.stringify({ amount, userId, metadata }),
      headers: { "Content-Type": "application/json" },
    });

    const { orderId } = await orderRes.json();

    if (!orderId) {
      toast({
        title: "Error",
        description: "Failed to create order",
      });
      return;
    }

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
      amount: amount * 100,
      currency: "INR",
      name: "Coldmail.io",
      description: "Subscription Payment",
      image: "/logo.svg",
      order_id: orderId,
      handler: async function (response: any) {
        const res = await fetch("/api/subscription-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });

        const data = await res.json();
        setSubscriptionInfo(data.subscription);
        toast({
          title: "Payment Successful",
          description: `Your subscription has been activated for ${response?.razorpay_payment_id}`,
        });
      },
      theme: { color: "#6366f1" },
    };

    const paymentObject = new window.Razorpay(options);
    paymentObject.open();
  };

  return (
    <>
      <section className="w-full py-12 md:py-24 lg:py-32 bg-gray-800 bg-opacity-50 shadow-gray-700">
        <div className="container max-w-6xl px-4 md:px-6">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
              Pricing Plans
            </h2>
            <p className="mt-4 text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
              Affordable, flexible and tailored to your needs.
            </p>
            <Button
              variant="outline"
              className="rounded-3xl mt-5 font-semibold border-gray-500"
            >
              Try the custom and pro plan with our 30-day FREE TRIAL!!
            </Button>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border bg-[#020817] p-6">
              <div className="mb-6 space-y-2">
                <h3 className="text-2xl font-bold">Default</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Perfect for individuals and small teams.
                </p>
              </div>
              <div className="mb-6 space-y-2">
                <p className="text-4xl font-bold">Free</p>
              </div>
              <ul className="mb-6 space-y-2 text-gray-500 dark:text-gray-400">
                <li className="flex items-center">
                  8 templates can be generated.
                </li>
              </ul>
            </div>
            <div className="rounded-lg border bg-[#020817] p-6">
              <div className="mb-6 space-y-2">
                <h3 className="text-2xl font-bold">Pro</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Perfect for growing teams and businesses.
                </p>
              </div>
              <div className="mb-6 space-y-2">
                <p className="text-4xl font-bold">₹99</p>
              </div>
              <ul className="mb-6 space-y-2 text-gray-500 dark:text-gray-400">
                <li className="flex items-center">
                  20 templates can be generated.
                </li>
              </ul>
              <Button
                className="w-full"
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  if (userId) paymentHandler(99, userId, { plan: "pro" });
                }}
                disabled={subscriptionInfo == "pro"}
              >
                {subscriptionInfo == "pro" ? "Current plan" : "Get started"}
              </Button>
            </div>
            <div className="rounded-lg border bg-[#020817] p-6">
              <div className="mb-6 space-y-2">
                <h3 className="text-2xl font-bold">Premium</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Perfect for large teams and organizations.
                </p>
              </div>
              <div className="mb-6 space-y-2">
                <p className="text-4xl font-bold">₹149</p>
              </div>
              <ul className="mb-6 space-y-2 text-gray-500 dark:text-gray-400">
                <li className="flex items-center">
                  Unlimited templates can be generated
                </li>
              </ul>
              <Button
                className="w-full"
                onClick={() =>
                  userId && paymentHandler(149, userId, { plan: "premium" })
                }
                disabled={subscriptionInfo == "premium"}
              >
                {subscriptionInfo == "premium" ? "Current plan" : "Get started"}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
